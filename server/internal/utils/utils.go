// internal/utils/utils.go

package utils

import (
	"fmt"
	"strconv"
	"time"
)

func Itoa(num int) string {
	return strconv.Itoa(num)
}

func GenerateRoomID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
