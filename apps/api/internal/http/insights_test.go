package http

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/thakornt/rep-right/apps/api/internal/domain/workout"
)

func TestInsightsRequireAuth(t *testing.T) {
	r := newWorkoutRouter(newFakeWorkouts())
	for _, p := range []string{"/v1/insights/load", "/v1/insights/return-plan"} {
		if w := send(r, http.MethodGet, p, "", nil); w.Code != http.StatusUnauthorized {
			t.Errorf("%s without token: %d", p, w.Code)
		}
	}
}

func TestLoadInsights(t *testing.T) {
	f := newFakeWorkouts()
	day := func(n int) workout.Logged {
		return workout.Logged{PerformedAt: fixedNow.Truncate(24*time.Hour).AddDate(0, 0, -n)}
	}
	prev, last := day(4), day(1)
	prev.Sets = []workout.Set{{ExerciseID: squat.ID, WeightKg: 100, Reps: 5}}
	last.Sets = []workout.Set{{ExerciseID: squat.ID, WeightKg: 120, Reps: 5}} // +20%
	user := testUser.ID
	f.sessions[uuid.New()] = ownedSession{user, prev}
	f.sessions[uuid.New()] = ownedSession{user, last}

	w := send(newWorkoutRouter(f), http.MethodGet, "/v1/insights/load", "", bearer)
	if w.Code != http.StatusOK {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
	var body struct {
		Disclaimer string             `json:"disclaimer"`
		Pain       bool               `json:"pain"`
		Exercises  []loadExerciseJSON `json:"exercises"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Disclaimer == "" || body.Pain || len(body.Exercises) != 1 {
		t.Fatalf("body = %s", w.Body)
	}
	e := body.Exercises[0]
	if e.Slug != "back-squat" || e.Advice != "hold" || len(e.Findings) != 1 || e.Findings[0].Rule != "weight_jump" {
		t.Errorf("exercise = %+v", e)
	}
	// The handler asked for the last 8 weeks.
	if f.to.Sub(f.from) < 56*24*time.Hour {
		t.Errorf("history window %v..%v too short", f.from, f.to)
	}
}

func TestReturnPlanInsights(t *testing.T) {
	f := newFakeWorkouts()
	today := fixedNow.Truncate(24 * time.Hour)
	f.tops = []workout.TopSet{
		{ExerciseID: squat.ID, PerformedAt: today.AddDate(0, 0, -30), WeightKg: 100}, // 70% over 3 weeks
		{ExerciseID: 6, PerformedAt: today.AddDate(0, 0, -2), WeightKg: 60},          // trained recently
	}
	w := send(newWorkoutRouter(f), http.MethodGet, "/v1/insights/return-plan", "", bearer)
	if w.Code != http.StatusOK {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
	var body struct {
		Disclaimer string           `json:"disclaimer"`
		Exercises  []returnPlanJSON `json:"exercises"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Disclaimer == "" || len(body.Exercises) != 1 {
		t.Fatalf("only the exercise with a break needs a plan: %s", w.Body)
	}
	p := body.Exercises[0]
	if p.Slug != "back-squat" || p.DaysOff != 30 || p.StartWeightKg != 70 || p.RampWeeks != 3 || len(p.Steps) != 4 ||
		p.LastPerformedAt != today.AddDate(0, 0, -30).Format(dateLayout) {
		t.Errorf("plan = %+v", p)
	}
}
