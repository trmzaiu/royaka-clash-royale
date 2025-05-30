package game

import (
	"encoding/json"
	"log"
	"royaka/internal/model"
	"royaka/internal/utils"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

func HandleSelectTroop(conn *websocket.Conn, data json.RawMessage) {
	var req utils.SelectTroopRequest

	if err := json.Unmarshal(data, &req); err != nil || req.RoomID == "" || req.Username == "" || req.Troop == "" {
		log.Printf("[ERROR][SELECT] Invalid request: %+v", req)
		conn.WriteJSON(utils.Response{
			Type:    "troop_response",
			Success: false,
			Message: "Invalid request",
		})
		return
	}

	log.Printf("[INFO][SELECT] %s is trying to spawn %s at (%f, %f) in room %s",
		req.Username, req.Troop, req.X, req.Y, req.RoomID)

	roomsMu.RLock()
	room, ok := rooms[req.RoomID]
	roomsMu.RUnlock()
	if !ok {
		log.Printf("[WARN][SELECT] Room %s not found", req.RoomID)
		conn.WriteJSON(utils.Response{
			Type:    "troop_response",
			Success: false,
			Message: "Room not found",
		})
		return
	}

	var player *model.Player
	if room.Player1.User.Username == req.Username {
		player = room.Player1
	} else if room.Player2.User.Username == req.Username {
		player = room.Player2
	} else {
		log.Printf("[WARN][SELECT] %s is not in the match", req.Username)
		conn.WriteJSON(utils.Response{
			Type:    "troop_response",
			Success: false,
			Message: "You are not in this match",
		})
		return
	}

	var selectedTemplate *model.Troop
	for i, t := range player.Troops {
		if t.Name == req.Troop {
			selectedTemplate = player.Troops[i]
			selectedTemplate.HP = selectedTemplate.MaxHP
			break
		}
	}
	if selectedTemplate == nil {
		log.Printf("[WARN][SELECT] Troop %s not found in %s's hand", req.Troop, req.Username)
		conn.WriteJSON(utils.Response{
			Type:    "troop_response",
			Success: false,
			Message: "Troop not in hand",
		})
		return
	}

	realX, realY := float64(req.X), float64(req.Y)

	if room.Player1.User.Username == req.Username {
		realX = 21.0 - req.X
		realY = 21.0 - req.Y
	}

	log.Printf("[INFO][SPAWN] %s spawned %s at (%f, %f)", req.Username, selectedTemplate.Name, realX, realY)

	if !room.Game.IsValidSpawnPosition(req.Username, realX, realY) {
		log.Printf("[WARN][SELECT] Invalid position (%f, %f) for %s", realX, realY, req.Username)
		conn.WriteJSON(utils.Response{
			Type:    "troop_response",
			Success: false,
			Message: "Invalid spawn position",
		})
		return
	}

	// Check mana
	if room.Game.Enhanced && player.Mana < selectedTemplate.MANA {
		log.Printf("[WARN][SELECT] Not enough mana for %s to use %s (has %d, needs %d)",
			req.Username, selectedTemplate.Name, player.Mana, selectedTemplate.MANA)
		conn.WriteJSON(utils.Response{
			Type:    "troop_response",
			Success: false,
			Message: "Not enough mana",
		})
		return
	}

	player.Mana -= selectedTemplate.MANA

	player.RotateTroop(req.Troop)

	// Tạo troop instance
	instance := &model.TroopInstance{
		ID:             uuid.New().String(),
		Template:       selectedTemplate,
		TypeEntity:     "troop",
		Owner:          player.User.Username,
		Position:       model.Position{X: realX, Y: realY},
		IsDead:         false,
		LastAttackTime: time.Now(),
		Mutex:          sync.RWMutex{},
	}

	room.Game.BattleSystem.AddEntity(instance)

	// Gửi lại troop mới spawn cho cả 2
	payload := utils.Response{
		Type:    "troop_response",
		Success: true,
		Message: "Troop spawned",
		Data: map[string]interface{}{
			"player": player,
			// "map":    room.Game.BattleSystem.BattleMap,
		},
	}

	log.Printf("[INFO][SELECT] Sending troop response to %s", req.Username)
	sendToClient(room.Player1.User.Username, payload)
	sendToClient(room.Player2.User.Username, payload)
}

func (g *Game) IsValidSpawnPosition(username string, x, y float64) bool {
	// 1. Check map boundaries
	if x < 0 || x >= 21 || y < 0 || y >= 21 {
		log.Printf("[INVALID_POS] (%.2f, %.2f) is out of bounds", x, y)
		return false
	}

	// 2. Check entity collision
	for _, entities := range g.BattleSystem.BattleMap {
		for _, entity := range entities {
			pos := entity.GetPosition()
			if calculateDistance(pos, model.Position{X: x, Y: y}) < 0.5 {
				log.Printf("[INVALID_POS] (%.2f, %.2f) too close to existing entity at (%.2f, %.2f)", x, y, pos.X, pos.Y)
				return false
			}
		}
	}

	// 3. Determine player type
	isPlayer1, valid := g.getPlayerType(username)
	if !valid {
		log.Printf("[INVALID_POS] Unknown player: %s", username)
		return false
	}

	// 4. Check if in ADVANCE ZONE
	if isPlayer1 && g.isInAdvanceZone(g.Player2, x, y, true) {
		log.Printf("[VALID_POS] Advance spawn for Player 1 at (%.2f, %.2f)", x, y)
		return true
	}
	if !isPlayer1 && g.isInAdvanceZone(g.Player1, x, y, false) {
		log.Printf("[VALID_POS] Advance spawn for Player 2 at (%.2f, %.2f)", x, y)
		return true
	}

	// 5. Check normal spawn zone
	if !isValidSpawnZone(isPlayer1, y, username) {
		return false
	}

	// 6. Disallow spawning in river unless on bridges
	if !isValidRiverArea(x, y) {
		return false
	}

	log.Printf("[VALID_POS] Normal spawn for %s at (%.2f, %.2f)", username, x, y)
	return true
}

// getPlayerType returns (isPlayer1, valid)
func (g *Game) getPlayerType(username string) (bool, bool) {
	if g.Player1.User.Username == username {
		return true, true
	} else if g.Player2.User.Username == username {
		return false, true
	}
	return false, false
}

func (g *Game) isInAdvanceZone(enemyPlayer *model.Player, x, y float64, isPlayer1 bool) bool {
	var yMin, yMax float64
	if isPlayer1 {
		yMin, yMax = 10, 14 // mở rộng xuống cầu
	} else {
		yMin, yMax = 7, 11 // mở rộng lên cầu
	}

	if y < yMin || y > yMax || !isValidRiverArea(x, y) {
		return false
	}

	guard1Dead := enemyPlayer.Towers["guard1"].HP <= 0
	guard2Dead := enemyPlayer.Towers["guard2"].HP <= 0

	// Áp dụng theo logic đúng
	switch {
	case guard1Dead && guard2Dead:
		return x >= 0 && x <= 21
	case guard1Dead:
		return x >= 0 && x <= 10
	case guard2Dead:
		return x >= 11 && x <= 21
	default:
		return false
	}
}

func isValidSpawnZone(isPlayer1 bool, y float64, username string) bool {
	if isPlayer1 {
		// Player 1 can only spawn in bottom half (Y: 0-9)
		if y > 9 {
			log.Printf("[INVALID_POS] Player 1 (%s) cannot spawn at Y=%f (must be ≤9)", username, y)
			return false
		}
	} else {
		// Player 2 can only spawn in top half (Y: 12-21)
		if y < 12 {
			log.Printf("[INVALID_POS] Player 2 (%s) cannot spawn at Y=%f (must be ≥12)", username, y)
			return false
		}
	}
	return true
}

func isValidRiverArea(x, y float64) bool {
	// Check river area (Y: 10-11) - no spawning in river
	if (y == 10 || y == 11) && (int(x) != 4 && int(x) != 17) {
		log.Printf("[INVALID_POS] Cannot spawn in river area at (%.0f, %.0f), except on bridges at x=4 or x=17", x, y)
		return false
	}
	return true
}
