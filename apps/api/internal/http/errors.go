package http

import (
	"github.com/gin-gonic/gin"
)

// Error codes shared with the frontend. Keep them stable once released.
const (
	CodeNotFound         = "not_found"
	CodeMethodNotAllowed = "method_not_allowed"
	CodeInternal         = "internal"
	CodeUnavailable      = "unavailable"
)

type errorBody struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// writeError sends the single error format used by every endpoint:
// {"error": {"code": "...", "message": "..."}}
func writeError(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, errorBody{Error: errorDetail{Code: code, Message: message}})
}
