package returnplan

import (
	"testing"
	"time"
)

var today = time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)

func plan(t *testing.T, daysOff int, topKg float64) Plan {
	t.Helper()
	return For(today.AddDate(0, 0, -daysOff), topKg, today, DefaultConfig())
}

func TestTiers(t *testing.T) {
	cases := []struct {
		daysOff        int
		needed         bool
		minPct, maxPct float64
		rampWeeks      int
		startKg        float64
	}{
		{0, false, 100, 100, 0, 100},
		{6, false, 100, 100, 0, 100},
		{7, true, 90, 90, 1, 90},
		{13, true, 90, 90, 1, 90},
		{14, true, 80, 80, 2, 80},
		{27, true, 80, 80, 2, 80},
		{28, true, 70, 70, 3, 70},
		{55, true, 70, 70, 3, 70},
		{56, true, 50, 60, 4, 50}, // start at the safe end of the range
		{400, true, 50, 60, 4, 50},
	}
	for _, tc := range cases {
		p := plan(t, tc.daysOff, 100)
		if p.Needed != tc.needed || p.StartPctMin != tc.minPct || p.StartPctMax != tc.maxPct ||
			p.RampWeeks != tc.rampWeeks || p.StartKg != tc.startKg || p.DaysOff != tc.daysOff {
			t.Errorf("%d days off: %+v", tc.daysOff, p)
		}
	}
}

func TestRoundsDownToPlateStep(t *testing.T) {
	// 90% of 117.5 = 105.75 -> 105; 80% of 61 = 48.8 -> 47.5.
	if p := plan(t, 10, 117.5); p.StartKg != 105 {
		t.Errorf("start = %v, want 105", p.StartKg)
	}
	if p := plan(t, 20, 61); p.StartKg != 47.5 {
		t.Errorf("start = %v, want 47.5", p.StartKg)
	}
	cfg := DefaultConfig()
	cfg.RoundToKg = 1
	if p := For(today.AddDate(0, 0, -20), 61, today, cfg); p.StartKg != 48 {
		t.Errorf("1 kg rounding: start = %v, want 48", p.StartKg)
	}
}

func TestStepsRampBackTo100(t *testing.T) {
	p := plan(t, 30, 100) // 70% over 3 weeks
	want := []Step{{1, 70, 70}, {2, 80, 80}, {3, 90, 90}, {4, 100, 100}}
	if len(p.Steps) != len(want) {
		t.Fatalf("steps = %+v", p.Steps)
	}
	for i, s := range want {
		if p.Steps[i] != s {
			t.Errorf("step %d = %+v, want %+v", i, p.Steps[i], s)
		}
	}
	for i := 1; i < len(p.Steps); i++ {
		if p.Steps[i].WeightKg < p.Steps[i-1].WeightKg {
			t.Errorf("weights must never go down: %+v", p.Steps)
		}
	}
	if last := p.Steps[len(p.Steps)-1]; last.Percent != 100 || last.WeightKg != 100 {
		t.Errorf("plan must end back at the old top set: %+v", last)
	}
}

func TestStepsNeverExceedOldTopSet(t *testing.T) {
	for _, days := range []int{8, 15, 30, 90} {
		for _, kg := range []float64{20, 61, 117.5, 142.5} {
			p := plan(t, days, kg)
			for _, s := range p.Steps {
				if s.WeightKg > kg {
					t.Errorf("%d days, %v kg: step above old top set: %+v", days, kg, s)
				}
			}
		}
	}
}

func TestNoBreakHasNoSteps(t *testing.T) {
	if p := plan(t, 3, 100); p.Needed || len(p.Steps) != 0 {
		t.Errorf("no plan needed under a week: %+v", p)
	}
}

func TestBodyweightExercise(t *testing.T) {
	p := plan(t, 30, 0)
	if !p.Needed || p.StartKg != 0 {
		t.Errorf("bodyweight: %+v", p)
	}
}
