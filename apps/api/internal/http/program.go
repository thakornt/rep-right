package http

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/thakornt/rep-right/apps/api/internal/domain/program"
)

// Programs stores which weekly program a user picked (*store.ProgramStore).
type Programs interface {
	Program(ctx context.Context, userID uuid.UUID) (string, error)
	SetProgram(ctx context.Context, userID uuid.UUID, id string) error
}

type programHandlers struct {
	store Programs
	log   *slog.Logger
}

// programJSON is {"program_id": "ppl-2"} or {"program_id": null}.
type programJSON struct {
	ProgramID *string `json:"program_id"`
}

func toProgramJSON(id string) programJSON {
	if id == "" {
		return programJSON{}
	}
	return programJSON{ProgramID: &id}
}

func (h programHandlers) get(c *gin.Context) {
	id, err := h.store.Program(c.Request.Context(), userID(c))
	if err != nil {
		h.internal(c, "get program", err)
		return
	}
	c.JSON(http.StatusOK, toProgramJSON(id))
}

func (h programHandlers) put(c *gin.Context) {
	var req struct {
		ProgramID string `json:"program_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, CodeInvalidRequest, "invalid JSON body")
		return
	}
	if !program.Valid(req.ProgramID) {
		writeError(c, http.StatusUnprocessableEntity, CodeValidationFailed, "unknown program_id")
		return
	}
	if err := h.store.SetProgram(c.Request.Context(), userID(c), req.ProgramID); err != nil {
		h.internal(c, "set program", err)
		return
	}
	c.JSON(http.StatusOK, toProgramJSON(req.ProgramID))
}

func (h programHandlers) delete(c *gin.Context) {
	if err := h.store.SetProgram(c.Request.Context(), userID(c), ""); err != nil {
		h.internal(c, "clear program", err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h programHandlers) internal(c *gin.Context, op string, err error) {
	h.log.ErrorContext(c.Request.Context(), op+" failed",
		slog.String("request_id", c.GetString(requestIDHeader)), slog.Any("error", err))
	writeError(c, http.StatusInternalServerError, CodeInternal, "internal server error")
}
