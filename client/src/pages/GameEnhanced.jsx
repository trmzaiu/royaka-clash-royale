import clsx from "clsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWebSocketContext } from "../context/WebSocketContext";

export default function GameEnhanced() {
    const navigate = useNavigate();
    const { sendMessage, subscribe } = useWebSocketContext();

    const containerRef = useRef(null);
    const damageTimeoutRef = useRef(null);
    const healTimeoutRef = useRef(null);
    // const hasLeftGameRef = useRef(false);

    const [user, setUser] = useState({});
    const [opponent, setOpponent] = useState({});
    const [game, setGame] = useState(getInitialGameState());
    const [isGameInitialized, setIsGameInitialized] = useState(false);
    const [hoveredTroop, setHoveredTroop] = useState(null);
    const [tileSize, setTileSize] = useState(0);

    const [damagePopup, setDamagePopup] = useState({
        targetId: null,
        amount: 0,
        isOpponent: false,
        visible: false,
        isCrit: false,
    });

    const [healPopup, setHealPopup] = useState({
        target: null,
        amount: 0,
        isOpponent: false,
        visible: false,
    });


    const [notification, setNotification] = useState({
        show: false,
        message: "",
    });

    // === Initial Game State ===
    function getInitialGameState() {
        return {
            isPlayer1: false,
            playerMana: 5,
            maxMana: 10,
            troops: {},
            selectedTroop: null,
            selectedTarget: null,
            gameOver: false,
            winner: null,
            message: "",
            map: []
        };
    }

    // === Notification Helper ===
    const showNotification = (message) => {
        setNotification({ show: true, message });
        setTimeout(
            () => setNotification((prev) => ({ ...prev, show: false })),
            4000
        );
    };

    useLayoutEffect(() => {
        if (containerRef.current) {
            const width = containerRef.current.offsetWidth;
            setTileSize(width / 22);
        }
    }, []);

    // === Effect: Initial Setup & WebSocket Subscription ===
    useEffect(() => {
        if (!localStorage.getItem("session_id")) {
            showNotification("Session expired. Redirecting to login...");
            navigate("/auth")
            return;
        }

        if (!localStorage.getItem("room_id")) {
            showNotification("Room not found. Redirecting to lobby...");
            navigate("/lobby")
            return;
        }

        const unsubscribe = subscribe(handleMessage);
        sendMessage({
            type: "get_game",
            data: {
                room_id: localStorage.getItem("room_id"),
                username: localStorage.getItem("username"),
            },
        });

        return () => {
            unsubscribe();
            // leaveGame();
            if (damageTimeoutRef.current) clearTimeout(damageTimeoutRef.current);
            if (healTimeoutRef.current) clearTimeout(healTimeoutRef.current);
        };

    }, [subscribe, sendMessage, navigate]);

    // === Message Handler ===
    const handleMessage = (res) => {
        switch (res.type) {
            case "game_response":
                console.log("Game Response:", res);
                if (res.success) {
                    handleSetGameState(res.data);
                } else {
                    showNotification(res.error || "Failed to get game data");
                }
                break;

            case "troop_response":
                console.log("Troop Response:", res);
                if (res.success) {
                    handleSetTroop(res.data);
                } else {
                    showNotification(res.error || "Failed to get troop data");
                }
                break;

            case "mana_update":
                // console.log("Mana Update:", res);
                if (res.success) {
                    handleSetMana(res.data);
                } else {
                    showNotification(res.error || "Failed to get mana data");
                }
                break;

            case "game_state":
                console.log("Battle Map:", res.data.battleMap);
                if (res.success) {
                    handleSetMap(res.data);
                } else {
                    showNotification(res.error || "Failed to get game data");
                }
                break;

            case "game_over_response":
                res.success && handleGameOver(res);
                break;

            default:
                res.message && showNotification(res.message);
        }
    };

    // === Game Initialization ===
    const initializeGame = (map, player1, troops, userData) => {
        setGame({
            isPlayer1: player1 === localStorage.getItem("username"),
            playerMana: userData.mana,
            maxMana: 10,
            troops: troops,
            selectedTroop: null,
            gameOver: false,
            winner: "",
            message: "",
            map: map
        });

        setIsGameInitialized(true);
    };

    // === Leave Game ===
    // const leaveGame = () => {
    //     if (hasLeftGameRef.current) return;

    //     hasLeftGameRef.current = true;
    //     sendMessage({
    //         type: "leave_game",
    //         data: {
    //             room_id: localStorage.getItem("room_id"),
    //             username: localStorage.getItem("username"),
    //         },
    //     });
    //     localStorage.removeItem("room_id");
    // };

    // === Select Troop ===
    const selectTroop = (troopName) => {
        const troop = game.troops[troopName];
        if (game.playerMana < troop.mana)
            return showNotification("Not enough mana.");

        setGame((prev) => ({ ...prev, selectedTroop: troop }));
    };

    const spawnTroop = (row, col) => {
        if (!game.selectedTroop) return;

        if (!isValidDrop(row)) return;

        sendMessage({
            type: "select_troop",
            data: {
                troop: game.selectedTroop.name,
                x: col,
                y: row,
                room_id: localStorage.getItem("room_id"),
                username: user.user?.username,
            },
        });

        console.log(row, col)

        setGame((prev) => ({ ...prev, selectedTroop: null }));
    }

    // === Handle Set Game Response ===
    const handleSetGameState = (msg) => {
        const { user, opponent, player1, map } = msg;
        setUser(user);
        setOpponent(opponent);

        if (!isGameInitialized) {
            initializeGame(
                map,
                player1,
                user.troops,
                user,
            );
        }
    }

    // === Handle Set Troops ===
    const handleSetTroop = (msg) => {
        const { player, map } = msg;
        if (player.user.username === localStorage.getItem("username")) {
            setUser(player);
            setGame((prev) => ({
                ...prev,
                troops: player.troops,
            }));
        }
        setGame((prev) => ({
            ...prev,
            map: map
        }));
    }

    // === Handle Set Mana ===
    const handleSetMana = (msg) => {
        const { player } = msg;
        if (player.user.username === localStorage.getItem("username")) {
            setUser(player);
            setGame((prev) => ({ ...prev, playerMana: player.mana }));
        }
    }

    const handleSetMap = (msg) => {
        const { battleMap } = msg;

        setGame(prev => {
            const oldMap = prev?.map || [];
            const newMap = battleMap;

            for (const newEntity of newMap) {
                // ✅ Chỉ xử lý TOWER
                if (newEntity.type_entity !== "tower") continue;

                const oldEntity = oldMap.find(e => e.id === newEntity.id);
                if (!oldEntity) continue;

                const isMe =
                    newEntity.owner === localStorage.getItem("username");
                const targetId = (isMe ? "player-" : "opponent-") + oldEntity.template.type;

                // DAMAGE
                if (newEntity.hp < oldEntity.hp) {
                    const damage = oldEntity.hp - newEntity.hp;
                    const isCrit = newEntity.last_action?.includes("crit") ?? false;

                    setDamagePopup({
                        targetId: targetId,
                        amount: damage,
                        isOpponent: !isMe,
                        visible: true,
                        crit: isCrit,
                    });

                    clearTimeout(damageTimeoutRef.current);
                    damageTimeoutRef.current = setTimeout(() => {
                        setDamagePopup(prev => ({ ...prev, visible: false }));
                    }, 1500);
                }

                // HEAL
                if (newEntity.hp > oldEntity.hp) {
                    const healAmount = newEntity.hp - oldEntity.hp;

                    setHealPopup({
                        targetId: targetId,
                        amount: healAmount,
                        isOpponent: !isMe,
                        visible: true,
                    });

                    clearTimeout(healTimeoutRef.current);
                    healTimeoutRef.current = setTimeout(() => {
                        setHealPopup(prev => ({ ...prev, visible: false }));
                    }, 1500);
                }
            }

            return { ...prev, map: battleMap };
        });
    };

    // === Handle Game Over ===
    const handleGameOver = (msg) => {
        setTimeout(() => {
            setGame((prev) => ({ ...prev, gameOver: true, winner: msg.data.winner.user.username }));
        }, 4000)
    };

    // === Play Again ===
    const handlePlayAgain = () => {
        setGame(getInitialGameState());
        setIsGameInitialized(false);

        sendMessage({
            type: "play_again",
            data: {
                session_id: localStorage.getItem("session_id"),
            },
        });

        localStorage.removeItem("room_id");
        navigate("/lobby");
    };

    function isValidDrop(row) {
        return row >= 10;
    }

    // Tower component for reusability 
    const Tower = ({ id, type, health, maxHealth, isOpponent }) => {
        const towerImage = type === "king"
            ? (isOpponent ? "/royaka-2025-fe/assets/King_Tower_Red.png" : "/royaka-2025-fe/assets/King_Tower_Blue.png")
            : (isOpponent ? "/royaka-2025-fe/assets/Guard_Tower_Red.png" : "/royaka-2025-fe/assets/Guard_Tower_Blue.png");

        return (
            <div
                className={`relative tower ${type} ${health <= 0 ? "grayscale" : ""} w-full h-full flex flex-col items-center justify-end`}
                style={{ fontFamily: "'ClashDisplay', sans-serif" }}
            >
                {/* Damage Popup */}
                {damagePopup?.visible && damagePopup.targetId === id && (
                    <div className={`absolute z-50 ${isOpponent ? "-bottom-15" : "-top-15"} -right-4 transform rotate-10 pointer-events-none`}>
                        <div className={`
                        flex justify-center items-center
                        ${damagePopup.crit ? "text-yellow-500 animate-clash-crit-popup" : "text-red-500 animate-clash-damage-popup"}
                    `}>
                            <div className="relative">
                                {["-left-1", "-right-1", "-top-1", "-bottom-1"].map((pos, i) => (
                                    <span key={i} className={`absolute font-extrabold ${damagePopup.crit ? "text-4xl" : "text-3xl"} text-white opacity-25 ${pos}`}>
                                        -{damagePopup.amount}
                                    </span>
                                ))}
                                <span className={`relative font-extrabold ${damagePopup.crit ? "text-4xl" : "text-3xl"}`}>
                                    -{damagePopup.amount}
                                </span>
                            </div>
                            {damagePopup.crit && (
                                <div className="absolute w-16 h-16 bg-yellow-400 rounded-full opacity-20 animate-clash-crit-burst" />
                            )}
                        </div>
                    </div>
                )}

                {/* Heal Popup */}
                {healPopup?.visible && healPopup.targetId === id && (
                    <div className={`absolute z-50 ${isOpponent ? "-bottom-15" : "-top-15"} rotate-10 pointer-events-none`}>
                        <div className="flex justify-center items-center text-green-700 animate-clash-heal-popup">
                            <div className="relative">
                                {["-left-0.5", "-right-0.5", "-top-0.5", "-bottom-0.5"].map((pos, i) => (
                                    <span key={i} className={`absolute font-extrabold text-3xl text-white opacity-25 ${pos}`}>
                                        +{healPopup.amount}
                                    </span>
                                ))}
                                <span className="relative font-extrabold text-3xl">
                                    +{healPopup.amount}
                                </span>
                            </div>
                            <div className="absolute w-12 h-12 bg-green-400 rounded-full opacity-20 animate-clash-heal-burst" />
                        </div>
                    </div>
                )}

                <div className="w-full h-full flex flex-col items-center justify-end relative">
                    {/* Opponent: HP bar goes under the image */}
                    {isOpponent ? (
                        <>
                            <img
                                src={towerImage}
                                alt={type}
                                className="relative w-full h-full object-contain px-1 py-1 drop-shadow-lg"
                            />
                            <div className="relative -bottom-5 tower-hp w-5/6">
                                <div className="hp-bar bg-gray-700 w-full h-3 rounded-full shadow-inner overflow-hidden border border-gray-800">
                                    <div
                                        className={`hp-fill bg-gradient-to-r ${health <= maxHealth / 3
                                            ? "from-red-500 to-red-400"
                                            : "from-green-500 to-green-400"
                                            } h-full rounded-full transition-all duration-500`}
                                        style={{
                                            width: `${Math.max(0, (health / maxHealth) * 100)}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="relative -top-3 tower-hp w-5/6">
                                <div className="hp-bar bg-gray-700 w-full h-3 rounded-full shadow-inner overflow-hidden border border-gray-800">
                                    <div
                                        className={`hp-fill bg-gradient-to-r ${health <= maxHealth / 3
                                            ? "from-red-500 to-red-400"
                                            : "from-green-500 to-green-400"
                                            } h-full rounded-full transition-all duration-500`}
                                        style={{
                                            width: `${Math.max(0, (health / maxHealth) * 100)}%`,
                                        }}
                                    />
                                </div>
                            </div>
                            <img
                                src={towerImage}
                                alt={type}
                                className="relative w-full h-full object-contain px-1 py-1 drop-shadow-lg"
                            />
                        </>
                    )}
                </div>
            </div>
        );
    };

    const tileMap = [
        ["00", "00", "00", "00", "00", "00", "00", "00", "00", "81", "82", "82", "83", "00", "00", "00", "00", "00", "00", "00", "00", "00"],
        ["00", "00", "00", "00", "00", "00", "00", "00", "00", "87", "80", "80", "88", "00", "00", "00", "00", "00", "00", "00", "00", "00"],
        ["00", "00", "02", "81", "82", "83", "00", "00", "00", "87", "80", "80", "88", "00", "00", "00", "81", "82", "83", "00", "00", "00"],
        ["00", "01", "00", "87", "80", "88", "00", "00", "00", "85", "84", "84", "86", "00", "00", "00", "87", "80", "88", "00", "00", "00"],
        ["00", "00", "00", "85", "80", "86", "00", "00", "00", "00", "00", "00", "00", "00", "00", "01", "85", "80", "86", "00", "01", "00"],
        ["00", "00", "00", "00", "08", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "08", "00", "00", "00", "00"],
        ["00", "01", "00", "00", "08", "00", "00", "00", "00", "00", "00", "00", "00", "02", "00", "00", "00", "08", "00", "00", "00", "00"],
        ["00", "00", "00", "00", "08", "01", "00", "00", "00", "00", "00", "00", "01", "00", "00", "00", "00", "08", "00", "00", "00", "00"],
        ["00", "00", "00", "00", "08", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "08", "00", "00", "00", "00"],
        ["00", "00", "00", "00", "08", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "08", "00", "00", "00", "00"],
        ["19", "19", "19", "19", "08", "19", "19", "19", "19", "19", "19", "19", "19", "19", "19", "19", "19", "08", "19", "19", "19", "19"],
        ["55", "55", "55", "55", "08", "55", "55", "55", "55", "55", "55", "55", "55", "55", "55", "55", "55", "08", "55", "55", "55", "55"],
        ["00", "00", "00", "00", "08", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "08", "00", "00", "00", "00"],
        ["00", "00", "00", "00", "08", "00", "00", "00", "00", "02", "00", "00", "00", "00", "00", "00", "00", "08", "00", "00", "00", "00"],
        ["00", "00", "00", "00", "08", "00", "00", "00", "00", "00", "00", "00", "01", "00", "00", "01", "00", "08", "00", "00", "00", "00"],
        ["00", "00", "00", "00", "08", "00", "00", "00", "01", "00", "00", "00", "00", "00", "00", "00", "00", "08", "00", "00", "00", "00"],
        ["00", "02", "00", "00", "08", "00", "00", "00", "00", "00", "00", "00", "00", "01", "00", "00", "00", "08", "00", "00", "00", "00"],
        ["00", "00", "00", "81", "80", "83", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "81", "80", "83", "00", "00", "00"],
        ["00", "00", "00", "87", "80", "88", "00", "00", "00", "81", "82", "82", "83", "00", "00", "00", "87", "80", "88", "00", "00", "00"],
        ["00", "00", "00", "85", "84", "86", "02", "00", "00", "87", "80", "80", "88", "00", "00", "00", "85", "84", "86", "00", "00", "01"],
        ["00", "00", "00", "00", "00", "00", "00", "00", "00", "87", "80", "80", "88", "00", "00", "00", "00", "02", "00", "00", "00", "00"],
        ["00", "00", "00", "00", "00", "00", "00", "00", "00", "85", "84", "84", "86", "00", "00", "00", "00", "00", "00", "00", "00", "00"],
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-500 to-blue-900">
            <div
                className="game-container bg-gradient-to-b from-blue-400 to-blue-600 p-2 rounded-lg shadow-xl max-w-2xl mx-auto relative overflow-hidden border-4 border-yellow-500"
                style={{ fontFamily: "'ClashDisplay', sans-serif" }}
            >
                {/* Decorative elements */}
                <div className="absolute -top-16 -left-16 w-32 h-32 bg-yellow-300 rounded-full opacity-20"></div>
                <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-yellow-300 rounded-full opacity-20"></div>

                {/* Game title */}
                <div className="text-center mb-2">
                    <h1 className="text-3xl text-yellow-400 drop-shadow-md transform rotate-2 mb-1">
                        ROYAKA
                    </h1>
                    <div className="w-32 h-1 bg-yellow-400 mx-auto rounded-full mb-2"></div>
                </div>

                {/* STATS BAR */}
                <div className="stats-bar flex justify-between items-center p-2 bg-gradient-to-r from-blue-900 to-blue-800 rounded-lg shadow-md mb-2">
                    {/* OPPONENT STATS */}
                    <div className="opponent-stats flex items-center">
                        <div className="opponent-avatar relative mx-2">
                            <img
                                src={`/royaka-2025-fe/assets/avatars/Avatar${opponent.user?.avatar}.png`}
                                alt="avatar"
                                className="w-12 h-12 rounded-full border-2 border-red-700 shadow-md transform hover:scale-105 transition-transform object-cover"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-red-700 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center border border-yellow-400">
                                {opponent.user?.level || 0}
                            </div>
                        </div>
                        <div className="stat-column ml-2">
                            <div className="stat">
                                <div className="stat-value name text-yellow-500 text-lg drop-shadow-md">
                                    {opponent.user?.username || "Waiting..."}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TIME DISPLAY */}
                    <div className="time-display text-center transform hover:scale-105 transition-transform mx-2">
                        <div
                            className={`text-lg px-4 pt-1 rounded-full bg-green-600 text-white`}
                        >
                            12:20
                        </div>
                    </div>
                </div>

                {/* BATTLEFIELD - GRID LAYOUT */}
                <div ref={containerRef} className="battle-container rounded-lg shadow-inner border-4 border-stone-600 overflow-hidden relative w-full aspect-square">
                    {/* Grid background */}
                    <div className="absolute inset-0 grid grid-cols-22 grid-rows-22 group">
                        {tileMap.map((row, rowIndex) =>
                            row.map((tile, colIndex) => {
                                const isPlayerSide = rowIndex >= 11;
                                const isEnemySide = !isPlayerSide;
                                const hasSelectedTroop = !!game.selectedTroop;

                                const canClick = isPlayerSide && hasSelectedTroop;

                                return (
                                    <div
                                        key={`r${rowIndex}-c${colIndex}`}
                                        className={clsx(
                                            "relative bg-cover flex items-center justify-center",
                                            canClick && isPlayerSide && "cursor-pointer hover:brightness-110",
                                            !canClick && isPlayerSide && "pointer-events-none",
                                            isEnemySide && !hasSelectedTroop && "pointer-events-none",
                                            isEnemySide && hasSelectedTroop ? "group-hover:pointer-events-none group-hover:cursor-not-allowed" : ""
                                        )}
                                        style={{
                                            backgroundImage: `url(/royaka-2025-fe/assets/tiles/tile_00${tile}.png)`,
                                        }}
                                        onClick={() => {
                                            if (!canClick) return;
                                            spawnTroop(rowIndex, colIndex);
                                        }}
                                    >
                                        {isEnemySide && hasSelectedTroop && (
                                            <div className="absolute inset-0 bg-red-700 opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none" />
                                        )}

                                        {((colIndex === 3 || colIndex === 16) && rowIndex === 10) && (
                                            <img
                                                src="/royaka-2025-fe/assets/tiles/tile_0071.png"
                                                alt="Tree"
                                                className="w-full h-full pointer-events-none select-none z-60"
                                                style={{ objectFit: "contain", transform: "translateX(12px)" }}
                                            />
                                        )}
                                        {(colIndex === 3 || colIndex === 16) && rowIndex === 11 && (
                                            <img
                                                src="/royaka-2025-fe/assets/tiles/tile_0047.png"
                                                alt="Tree"
                                                className="w-full h-full pointer-events-none select-none z-60"
                                                style={{ objectFit: "cover", transform: "translateX(12px)" }}
                                            />
                                        )}

                                        {((colIndex === 5 || colIndex === 18) && rowIndex === 10) && (
                                            <img
                                                src="/royaka-2025-fe/assets/tiles/tile_0071.png"
                                                alt="Tree"
                                                className="w-full h-full pointer-events-none select-none z-60"
                                                style={{ objectFit: "contain", transform: "translateX(-12px)" }}
                                            />
                                        )}
                                        {(colIndex === 5 || colIndex === 18) && rowIndex === 11 && (
                                            <img
                                                src="/royaka-2025-fe/assets/tiles/tile_0047.png"
                                                alt="Tree"
                                                className="w-full h-full pointer-events-none select-none z-60"
                                                style={{ objectFit: "contain", transform: "translateX(-12px)" }}
                                            />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Battlefield grid layout - 22 columns x 6 rows */}
                    <div className="grid-battlefield grid grid-cols-22 grid-rows-22 relative w-full aspect-square pointer-events-none">
                        {game?.map?.filter(e => e.type_entity === "tower").map((tower) => {
                            const isEnemyTower = tower.owner !== localStorage.getItem("username");

                            const topLeftX = game.isPlayer1 ? 21 - tower.area.bottom_right.x : tower.area.top_left.x;
                            const topLeftY = game.isPlayer1 ? 21 - tower.area.bottom_right.y : tower.area.top_left.y;
                            const bottomRightX = game.isPlayer1 ? 21 - tower.area.top_left.x : tower.area.bottom_right.x;
                            const bottomRightY = game.isPlayer1 ? 21 - tower.area.top_left.y : tower.area.bottom_right.y;

                            const towerWidthPx = tileSize * (bottomRightX - topLeftX + 1);
                            const towerHeightPx = tileSize * (bottomRightY - topLeftY + 1);

                            const translateX = topLeftX * tileSize;
                            const translateY = topLeftY * tileSize;

                            const towerId = isEnemyTower ? "opponent" : "player" + "-" + tower.template.type

                            return (
                                <div
                                    key={tower.id}
                                    className="absolute z-20"
                                    style={{
                                        width: `${towerWidthPx}px`,
                                        height: `${towerHeightPx}px`,
                                        transform: `translate(${translateX}px, ${translateY}px)`,
                                    }}
                                >
                                    <Tower
                                        type={tower.template.type}
                                        id={towerId}
                                        health={tower.template.hp}
                                        maxHealth={tower.template.max_hp}
                                        isOpponent={isEnemyTower}
                                        className="w-full h-full"
                                    />
                                </div>
                            );
                        })}

                        {game?.map?.filter(e => e.type_entity === "troop").map((troop) => {
                            const isEnemyTroop = troop.owner !== user?.user.username;

                            const displayX = game.isPlayer1 ? 20 - troop.position.x : troop.position.x;
                            const displayY = game.isPlayer1 ? 20 - troop.position.y : troop.position.y;

                            const troopWidth = 48;
                            const troopHeight = 48;

                            const translateX = displayX * tileSize + tileSize / 2 - troopWidth / 2;
                            const translateY = displayY * tileSize + tileSize - troopHeight;

                            return (
                                <div
                                    key={troop.id}
                                    className="absolute smooth-move"
                                    style={{
                                        transform: `translate(${translateX}px, ${translateY}px)`,
                                    }}
                                >
                                    <img
                                        src={`/royaka-2025-fe/assets/images/${troop.template.image}.png`}
                                        alt={troop.template.name}
                                        className={`w-12 h-12 object-cover ${isEnemyTroop ? "opacity-80" : ""}`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* MANA BAR */}
                <div className="mana-container bg-gradient-to-r from-blue-900 to-blue-800 p-2 rounded-lg border-2 border-blue-700 my-2 shadow-md">
                    <div className="flex items-center justify-between mb-1">
                        <div className="text-lg text-yellow-400 flex items-center">
                            <span className="text-xl mr-1">⚡</span> MANA
                        </div>
                        <div className="text-xl text-white me-1">
                            {game.playerMana}/{game.maxMana}
                        </div>
                    </div>
                    <div className="mana-bar bg-gray-800 h-6 rounded-full shadow-inner overflow-hidden border border-gray-900 flex">
                        {Array.from({ length: game.maxMana }).map((_, i) => (
                            <div
                                key={i}
                                className={`mana-segment flex-1 h-full border-r border-gray-700 last:border-r-0 transition-all ${i < game.playerMana
                                    ? "bg-gradient-to-r from-blue-400 to-blue-400"
                                    : ""
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* TROOP SELECTION */}
                <div className="troops-container bg-gradient-to-r from-blue-900 to-blue-800 p-2 pb-1 rounded-lg mt-2 shadow-md border-2 border-blue-700">
                    <div className="section-header flex justify-between items-center mb-0.5 px-1">
                        <h3 className="text-lg text-yellow-400 drop-shadow-md">TROOPS</h3>
                    </div>

                    <div className="troop-selection flex flex-wrap justify-center gap-3">
                        {Object.entries(game.troops).map(([troopName, troop], index) => {
                            if (!troop) return null;

                            const isSelected = game.selectedTroop?.name === troop.name;
                            const isDisabled = game.playerMana < troop.mana;

                            return (
                                <div key={index} className="relative"
                                    onMouseEnter={() => setHoveredTroop(troopName)}
                                    onMouseLeave={() => setHoveredTroop(null)}
                                >
                                    {hoveredTroop === troopName && (
                                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-52 bg-gray-800 text-white rounded-lg shadow-lg z-20 overflow-hidden">
                                            {/* Troop Header */}
                                            <div className="bg-gradient-to-r from-blue-700 to-blue-900 p-2 border-b border-gray-600">
                                                <h4 className="text-yellow-300 text-center">{troop.name}</h4>
                                            </div>

                                            {/* Troop Type */}
                                            <div className="px-2 py-1 bg-gray-700 text-center">
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded-full ${troop.type === "damage dealer" ? "bg-red-500" :
                                                        troop.type === "tank" ? "bg-blue-500" :
                                                            troop.type === "buf" ? "bg-yellow-500" :
                                                                troop.type === "healer" ? "bg-green-500" :
                                                                    "bg-gray-500"
                                                        }`}
                                                >
                                                    {troop.type}
                                                </span>
                                            </div>

                                            {/* Troop Description */}
                                            <div className="p-2 pb-1 border-b border-gray-600 text-center italic text-[11px]">
                                                {troop.description}
                                            </div>

                                            {/* Troop Stats */}
                                            <div className="p-2">
                                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                                    <div className="flex items-center">
                                                        <span className="w-5 h-5 rounded-full bg-red-400 flex items-center justify-center mr-1">❤️</span>
                                                        <span className="text-[11px]">HP: {troop.max_hp}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center mr-1">⚔️</span>
                                                        <span className="text-[11px]">ATK: {troop.atk}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center mr-1">🛡️</span>
                                                        <span className="text-[11px]">DEF: {troop.def}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="w-5 h-5 rounded-full bg-purple-400 flex items-center justify-center mr-1">🎯</span>
                                                        <span className="text-[11px]">CRIT: {troop.crit}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        className={`troop relative rounded-xl shadow-lg overflow-hidden cursor-pointer transition-all duration-200 
                                            ${isSelected ? "border-4 border-yellow-400 transform scale-105" : "border-2 border-gray-700"}
                                            ${isDisabled ? "opacity-60 grayscale" : "hover:scale-105"}
                                        `}
                                        onClick={() => !isDisabled && selectTroop(troopName)}
                                    >
                                        <div className="w-full relative">
                                            <img
                                                className="w-35 h-36 object-cover"
                                                src={`/royaka-2025-fe/assets/cards/Card_${troop.image}.png`}
                                                alt={troopName}
                                            />

                                            {/* Type indicator */}
                                            <div className="absolute top-1 left-1">
                                                <span
                                                    className={`text-xs px-2 py-1 rounded-full shadow-md ${troop.type === "damage dealer" ? "bg-red-500 text-white" :
                                                        troop.type === "tank" ? "bg-blue-500 text-white" :
                                                            troop.type === "buf" ? "bg-yellow-500 text-black" :
                                                                troop.type === "healer" ? "bg-green-500 text-white" :
                                                                    "bg-gray-500"
                                                        }`}
                                                >
                                                    {troop.type === "damage dealer" && "DMG"}
                                                    {troop.type === "tank" && "TANK"}
                                                    {troop.type === "buf" && "BUFF"}
                                                    {troop.type === "healer" && "HEAL"}
                                                </span>
                                            </div>

                                            {/* Mana cost */}
                                            <div className="absolute bottom-1 right-1 bg-blue-800 bg-opacity-80 rounded-full w-8 h-8 flex items-center justify-center shadow-md border border-blue-400">
                                                <span className="text-white text-lg mt-1 leading-none">{troop.mana}</span>
                                            </div>

                                        </div>
                                        <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-1 text-center">
                                            <span className="text-white text-sm font-semibold truncate block">{troop.name}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* NOTIFICATION */}
                {notification.show && (
                    <div className="notification fixed top-5 left-0 right-0 mx-auto max-w-md bg-yellow-400 px-4 py-2 text-center rounded-full shadow-lg border-2 border-yellow-500 animate-bounce">
                        <span className="text-blue-900">{notification.message}</span>
                    </div>
                )}

                {/* GAME OVER MODAL */}
                {game.gameOver && (
                    <div className="game-over-modal fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                        <div className="modal-content bg-gradient-to-b from-blue-800 to-blue-900 rounded-lg shadow-xl p-6 max-w-md w-full border-4 border-yellow-500 transform scale-105 animate-pulse">
                            {/* Crown decoration */}
                            <div className="crown-decoration absolute -top-10 left-1/2 transform -translate-x-1/2 text-6xl">
                                {game.winner === user.user?.username
                                    ? "👑"
                                    : "☠️"}
                            </div>

                            <h2
                                className={`modal-title text-3xl mb-4 text-center ${game.winner === user.user?.username
                                    ? "text-yellow-400"
                                    : "text-red-400"
                                    }`}
                            >
                                {game.winner === user.user?.username
                                    ? "VICTORY!"
                                    : "DEFEAT"}
                            </h2>

                            <div className="modal-body text-center">
                                {(() => {
                                    let victoryMessage = "";
                                    if (game.winner === localStorage.getItem("username")) {
                                        victoryMessage = game.message !== ""
                                            ? "You have conquered your opponent's kingdom!"
                                            : "You won by opponent leaving the battle!";
                                    } else {
                                        victoryMessage = "Your kingdom has fallen to the enemy!";
                                    }
                                    return (
                                        <p className="text-white text-lg mb-3">
                                            {victoryMessage}
                                        </p>
                                    );
                                })()}
                                <div className="exp-gain text-yellow-300 text-2xl mt-3 animate-pulse">
                                    {game.winner === user.user?.username
                                        ? "+30 XP"
                                        : ""}
                                </div>
                                <img src={game.winner === user.user?.username
                                    ? "/royaka-2025-fe/assets/win.png"
                                    : "/royaka-2025-fe/assets/lose.png"}
                                    alt={game.winner === user.user?.username
                                        ? "Winner"
                                        : "Loser"} className="w-40 h-40 mx-auto" />
                            </div>

                            <div className="modal-buttons text-center">
                                <button
                                    className="play-again-btn bg-gradient-to-r from-yellow-400 to-yellow-500 text-blue-900 px-8 py-3 rounded-full text-lg border-4 border-yellow-600 shadow-lg transform hover:scale-105 transition-transform"
                                    onClick={handlePlayAgain}
                                >
                                    PLAY AGAIN
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}