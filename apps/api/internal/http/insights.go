package http

import (
	"net/http"
	"sort"

	"github.com/gin-gonic/gin"

	"github.com/thakornt/rep-right/apps/api/internal/domain/load"
	"github.com/thakornt/rep-right/apps/api/internal/domain/returnplan"
	"github.com/thakornt/rep-right/apps/api/internal/domain/workout"
)

// loadHistoryDays covers the acute week plus the chronic baseline weeks, with
// a margin so the previous session for the weight-jump rule is usually there.
const loadHistoryDays = 56

type findingJSON struct {
	Rule    load.Rule  `json:"rule"`
	Level   load.Level `json:"level"`
	Value   float64    `json:"value"`
	Message string     `json:"message"`
}

type exerciseRefJSON struct {
	ExerciseID int32  `json:"exercise_id"`
	Slug       string `json:"slug"`
	NameTH     string `json:"name_th"`
}

type loadExerciseJSON struct {
	exerciseRefJSON
	Advice   load.Advice   `json:"advice"`
	Findings []findingJSON `json:"findings"`
}

type stepJSON struct {
	Week     int     `json:"week"`
	Percent  float64 `json:"percent"`
	WeightKg float64 `json:"weight_kg"`
}

type returnPlanJSON struct {
	exerciseRefJSON
	LastPerformedAt string     `json:"last_performed_at"`
	DaysOff         int        `json:"days_off"`
	TopSetKg        float64    `json:"top_set_kg"`
	StartPercentMin float64    `json:"start_percent_min"`
	StartPercentMax float64    `json:"start_percent_max"`
	StartWeightKg   float64    `json:"start_weight_kg"`
	RampWeeks       int        `json:"ramp_weeks"`
	Steps           []stepJSON `json:"steps"`
}

func (h workoutHandlers) exerciseIndex(c *gin.Context) (map[int32]workout.Exercise, bool) {
	list, err := h.store.ListExercises(c.Request.Context())
	if err != nil {
		h.internal(c, "list exercises", err)
		return nil, false
	}
	idx := make(map[int32]workout.Exercise, len(list))
	for _, e := range list {
		idx[e.ID] = e
	}
	return idx, true
}

func ref(idx map[int32]workout.Exercise, id int32) exerciseRefJSON {
	e := idx[id]
	return exerciseRefJSON{ExerciseID: id, Slug: e.Slug, NameTH: e.NameTH}
}

// loadInsights runs the load rules over the last loadHistoryDays of sessions.
func (h workoutHandlers) loadInsights(c *gin.Context) {
	idx, ok := h.exerciseIndex(c)
	if !ok {
		return
	}
	today := h.today()
	sessions, err := h.store.ListSessions(c.Request.Context(), userID(c),
		today.AddDate(0, 0, -loadHistoryDays), today.AddDate(0, 0, 1), maxListRows)
	if err != nil {
		h.internal(c, "list sessions", err)
		return
	}
	lower := make(map[int32]bool, len(idx))
	for id, e := range idx {
		lower[id] = e.IsLowerBody
	}
	r := load.Analyze(sessions, lower, today, load.DefaultConfig())

	out := make([]loadExerciseJSON, len(r.Exercises))
	for i, e := range r.Exercises {
		fs := make([]findingJSON, len(e.Findings))
		for j, f := range e.Findings {
			fs[j] = findingJSON(f)
		}
		out[i] = loadExerciseJSON{exerciseRefJSON: ref(idx, e.ExerciseID), Advice: e.Advice, Findings: fs}
	}
	c.JSON(http.StatusOK, gin.H{"disclaimer": r.Disclaimer, "pain": r.Pain, "exercises": out})
}

// returnPlan lists a ramp-back plan for every exercise not done for a week or more.
func (h workoutHandlers) returnPlan(c *gin.Context) {
	idx, ok := h.exerciseIndex(c)
	if !ok {
		return
	}
	tops, err := h.store.LatestTopSets(c.Request.Context(), userID(c))
	if err != nil {
		h.internal(c, "latest top sets", err)
		return
	}
	sort.Slice(tops, func(i, j int) bool { return tops[i].ExerciseID < tops[j].ExerciseID })

	today := h.today()
	out := []returnPlanJSON{}
	for _, t := range tops {
		p := returnplan.For(t.PerformedAt, t.WeightKg, today, returnplan.DefaultConfig())
		if !p.Needed {
			continue
		}
		steps := make([]stepJSON, len(p.Steps))
		for i, s := range p.Steps {
			steps[i] = stepJSON(s)
		}
		out = append(out, returnPlanJSON{
			exerciseRefJSON: ref(idx, t.ExerciseID),
			LastPerformedAt: t.PerformedAt.Format(dateLayout),
			DaysOff:         p.DaysOff,
			TopSetKg:        p.TopKg,
			StartPercentMin: p.StartPctMin,
			StartPercentMax: p.StartPctMax,
			StartWeightKg:   p.StartKg,
			RampWeeks:       p.RampWeeks,
			Steps:           steps,
		})
	}
	c.JSON(http.StatusOK, gin.H{"disclaimer": load.Disclaimer, "exercises": out})
}
