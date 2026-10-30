package load

import (
	"testing"
	"time"

	"github.com/thakornt/rep-right/apps/api/internal/domain/workout"
)

var today = time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)

const (
	squat int32 = 1 // lower body
	bench int32 = 6 // upper body
)

var lower = map[int32]bool{squat: true, bench: false}

func day(daysAgo int) time.Time { return today.AddDate(0, 0, -daysAgo) }

func rpe(v float64) *float64 { return &v }

func sess(daysAgo int, sets ...workout.Set) workout.Logged {
	return workout.Logged{PerformedAt: day(daysAgo), Sets: sets}
}

func set(ex int32, kg float64, reps int, r *float64) workout.Set {
	return workout.Set{ExerciseID: ex, WeightKg: kg, Reps: reps, RPE: r}
}

func findings(t *testing.T, r Report, ex int32) []Finding {
	t.Helper()
	for _, e := range r.Exercises {
		if e.ExerciseID == ex {
			return e.Findings
		}
	}
	t.Fatalf("exercise %d not in report %+v", ex, r)
	return nil
}

func has(fs []Finding, rule Rule, level Level) bool {
	for _, f := range fs {
		if f.Rule == rule && f.Level == level {
			return true
		}
	}
	return false
}

func TestWeightJumpLowerBody(t *testing.T) {
	cfg := DefaultConfig()
	// 100 -> 110 is exactly 10%: not more than 10%, so fine.
	r := Analyze([]workout.Logged{sess(3, set(squat, 100, 5, nil)), sess(1, set(squat, 110, 5, nil))}, lower, today, cfg)
	if has(findings(t, r, squat), RuleWeightJump, LevelCaution) {
		t.Error("+10% on a lower-body lift should not warn")
	}
	// 100 -> 112.5 is 12.5%.
	r = Analyze([]workout.Logged{sess(3, set(squat, 100, 5, nil)), sess(1, set(squat, 112.5, 3, nil))}, lower, today, cfg)
	if !has(findings(t, r, squat), RuleWeightJump, LevelCaution) {
		t.Error("+12.5% on a lower-body lift should warn")
	}
}

func TestWeightJumpUpperBodyUsesTopSet(t *testing.T) {
	cfg := DefaultConfig()
	// Top sets 60 -> 65 (+8.3%); the lighter warm-up sets must not matter.
	prev := sess(4, set(bench, 40, 10, nil), set(bench, 60, 5, nil))
	last := sess(1, set(bench, 40, 10, nil), set(bench, 65, 5, nil))
	r := Analyze([]workout.Logged{last, prev}, lower, today, cfg)
	if !has(findings(t, r, bench), RuleWeightJump, LevelCaution) {
		t.Error("+8.3% on an upper-body lift should warn (limit 5%)")
	}
	r = Analyze([]workout.Logged{sess(4, set(bench, 60, 5, nil)), sess(1, set(bench, 62.5, 5, nil))}, lower, today, cfg)
	if has(findings(t, r, bench), RuleWeightJump, LevelCaution) {
		t.Error("+4.2% on an upper-body lift should not warn")
	}
}

func TestWeightJumpIgnoresSmallestIncrement(t *testing.T) {
	cfg := DefaultConfig()
	// 10 -> 12.5 kg dumbbells is +25% but only one 2.5 kg step.
	r := Analyze([]workout.Logged{sess(4, set(bench, 10, 10, nil)), sess(1, set(bench, 12.5, 10, nil))}, lower, today, cfg)
	if has(findings(t, r, bench), RuleWeightJump, LevelCaution) {
		t.Error("a single 2.5 kg step should not warn")
	}
	// 10 -> 15 kg is two steps (+50%): warn.
	r = Analyze([]workout.Logged{sess(4, set(bench, 10, 10, nil)), sess(1, set(bench, 15, 10, nil))}, lower, today, cfg)
	if !has(findings(t, r, bench), RuleWeightJump, LevelCaution) {
		t.Error("+5 kg on a 10 kg dumbbell should warn")
	}
	// Setting MinJumpKg to 0 restores the pure percentage rule.
	cfg.MinJumpKg = 0
	r = Analyze([]workout.Logged{sess(4, set(bench, 10, 10, nil)), sess(1, set(bench, 12.5, 10, nil))}, lower, today, cfg)
	if !has(findings(t, r, bench), RuleWeightJump, LevelCaution) {
		t.Error("with MinJumpKg 0, +25% should warn")
	}
}

func TestWeightJumpSkipsBodyweightBaseline(t *testing.T) {
	r := Analyze([]workout.Logged{sess(4, set(bench, 0, 8, nil)), sess(1, set(bench, 10, 5, nil))}, lower, today, DefaultConfig())
	if has(findings(t, r, bench), RuleWeightJump, LevelCaution) {
		t.Error("no percentage can be computed from a 0 kg baseline")
	}
}

func TestVolumeSpike(t *testing.T) {
	cfg := DefaultConfig()
	// Chronic: 4 weeks of 1000 kg/week (100 kg x 10 reps), one session each.
	base := []workout.Logged{
		sess(10, set(squat, 100, 10, nil)),
		sess(17, set(squat, 100, 10, nil)),
		sess(24, set(squat, 100, 10, nil)),
		sess(31, set(squat, 100, 10, nil)),
	}
	cases := []struct {
		acuteKg float64 // volume in the last 7 days
		want    Level
	}{
		{1300, ""},           // ratio 1.3: not above
		{1400, LevelCaution}, // 1.4
		{1600, LevelRisk},    // 1.6
	}
	for _, tc := range cases {
		sessions := append([]workout.Logged{sess(2, set(squat, tc.acuteKg/10, 10, nil))}, base...)
		fs := findings(t, Analyze(sessions, lower, today, cfg), squat)
		got := Level("")
		for _, f := range fs {
			if f.Rule == RuleVolumeSpike {
				got = f.Level
			}
		}
		if got != tc.want {
			t.Errorf("acute %v kg: level = %q, want %q (%+v)", tc.acuteKg, got, tc.want, fs)
		}
	}
}

func TestVolumeSpikeNeedsBaseline(t *testing.T) {
	// A brand-new lifter has no chronic volume; no ratio, no warning.
	r := Analyze([]workout.Logged{sess(1, set(squat, 60, 10, nil))}, lower, today, DefaultConfig())
	if has(findings(t, r, squat), RuleVolumeSpike, LevelCaution) || has(findings(t, r, squat), RuleVolumeSpike, LevelRisk) {
		t.Error("no baseline, no volume warning")
	}
}

func TestHighRPEStreak(t *testing.T) {
	cfg := DefaultConfig()
	two := []workout.Logged{sess(1, set(squat, 100, 5, rpe(9))), sess(4, set(squat, 100, 5, rpe(9.5)))}
	r := Analyze(two, lower, today, cfg)
	e := r.Exercises[0]
	if !has(e.Findings, RuleHighRPEStreak, LevelCaution) || e.Advice != AdviceHold {
		t.Errorf("two sessions at RPE >= 9 should advise holding: %+v", e)
	}

	// Broken streak (RPE 8 in between) or missing RPE does not count.
	broken := []workout.Logged{sess(1, set(squat, 100, 5, rpe(9))), sess(4, set(squat, 100, 5, rpe(8))), sess(7, set(squat, 100, 5, rpe(9)))}
	if has(findings(t, Analyze(broken, lower, today, cfg), squat), RuleHighRPEStreak, LevelCaution) {
		t.Error("streak broken by an RPE 8 session")
	}
	noRPE := []workout.Logged{sess(1, set(squat, 100, 5, rpe(9))), sess(4, set(squat, 100, 5, nil))}
	if has(findings(t, Analyze(noRPE, lower, today, cfg), squat), RuleHighRPEStreak, LevelCaution) {
		t.Error("missing RPE is not a high RPE")
	}
}

func TestPainStopsProgressionEverywhere(t *testing.T) {
	cfg := DefaultConfig()
	painful := sess(2, set(bench, 60, 5, nil))
	painful.PainFlag = true
	r := Analyze([]workout.Logged{painful, sess(1, set(squat, 100, 5, nil))}, lower, today, cfg)
	if !r.Pain {
		t.Fatal("recent pain_flag must be reported")
	}
	for _, e := range r.Exercises {
		if e.Advice != AdviceNoIncrease || !has(e.Findings, RulePain, LevelRisk) {
			t.Errorf("exercise %d: pain must stop increases, got %+v", e.ExerciseID, e)
		}
	}

	// Pain older than the lookback no longer blocks progression.
	old := sess(cfg.PainLookbackDays+1, set(bench, 60, 5, nil))
	old.PainFlag = true
	if r := Analyze([]workout.Logged{old, sess(1, set(squat, 100, 5, nil))}, lower, today, cfg); r.Pain {
		t.Error("pain outside the lookback window should not be active")
	}
}

func TestCleanHistoryAllowsProgress(t *testing.T) {
	r := Analyze([]workout.Logged{sess(1, set(squat, 102.5, 5, rpe(7))), sess(4, set(squat, 100, 5, rpe(7)))}, lower, today, DefaultConfig())
	if r.Pain || len(r.Exercises) != 1 || r.Exercises[0].Advice != AdviceProgressOK || len(r.Exercises[0].Findings) != 0 {
		t.Errorf("report = %+v", r)
	}
}

func TestMessagesAreThaiGuidance(t *testing.T) {
	painful := sess(1, set(squat, 100, 5, nil))
	painful.PainFlag = true
	r := Analyze([]workout.Logged{painful}, lower, today, DefaultConfig())
	if r.Disclaimer == "" {
		t.Error("every report carries the general-guidance disclaimer")
	}
	for _, f := range r.Exercises[0].Findings {
		if f.Message == "" {
			t.Errorf("finding without message: %+v", f)
		}
	}
}
