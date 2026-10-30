// Package load flags training-load changes that are worth slowing down for.
// It is pure: callers pass the user's recent sessions and get a report back.
//
// These are general warning signals, not predictions or diagnoses. In
// particular the acute:chronic workload ratio behind RuleVolumeSpike is
// debated in the research literature; it is used here only as a prompt to
// slow down, never as an injury predictor.
package load

import (
	"fmt"
	"sort"
	"time"

	"github.com/thakornt/rep-right/apps/api/internal/domain/workout"
)

type Rule string

const (
	RuleWeightJump    Rule = "weight_jump"
	RuleVolumeSpike   Rule = "volume_spike"
	RuleHighRPEStreak Rule = "high_rpe_streak"
	RulePain          Rule = "pain"
)

type Level string

const (
	LevelCaution Level = "caution"
	LevelRisk    Level = "risk"
)

type Advice string

const (
	AdviceProgressOK Advice = "progress_ok" // nothing flagged
	AdviceHold       Advice = "hold"        // keep the weight for now
	AdviceNoIncrease Advice = "no_increase" // pain reported: do not add load, see a professional
)

const Disclaimer = "ข้อมูลนี้เป็นแนวทางทั่วไปเพื่อช่วยให้ซ้อมอย่างปลอดภัย ไม่ใช่คำวินิจฉัยหรือคำแนะนำทางการแพทย์"

// Config holds the thresholds. DefaultConfig is deliberately conservative.
type Config struct {
	LowerBodyJumpPct float64 // warn when the top set rises by more than this
	UpperBodyJumpPct float64
	VolumeCaution    float64 // acute:chronic ratio above which to warn
	VolumeRisk       float64
	AcuteDays        int // "this week"
	ChronicWeeks     int // baseline = average of this many weeks before it
	HighRPE          float64
	HighRPESessions  int // consecutive sessions at or above HighRPE
	PainLookbackDays int // a pain_flag this recent blocks increases
}

func DefaultConfig() Config {
	return Config{
		LowerBodyJumpPct: 10,
		UpperBodyJumpPct: 5,
		VolumeCaution:    1.3,
		VolumeRisk:       1.5,
		AcuteDays:        7,
		ChronicWeeks:     4,
		HighRPE:          9,
		HighRPESessions:  2,
		PainLookbackDays: 7,
	}
}

type Finding struct {
	Rule    Rule
	Level   Level
	Value   float64 // percent jump, volume ratio or streak length
	Message string  // Thai, shown to the user
}

type ExerciseReport struct {
	ExerciseID int32
	Advice     Advice
	Findings   []Finding
}

type Report struct {
	Pain       bool
	Disclaimer string
	Exercises  []ExerciseReport // ordered by exercise ID
}

// exerciseSession is one session reduced to a single exercise.
type exerciseSession struct {
	date   time.Time
	topKg  float64
	volume float64
	maxRPE float64 // 0 when no set has an RPE
}

// Analyze evaluates every exercise that appears in sessions. isLowerBody maps
// exercise IDs to the lower/upper-body flag; today is a UTC date.
func Analyze(sessions []workout.Logged, isLowerBody map[int32]bool, today time.Time, cfg Config) Report {
	pain := false
	painSince := today.AddDate(0, 0, -cfg.PainLookbackDays)
	byExercise := map[int32][]exerciseSession{}
	for _, s := range sessions {
		if s.PainFlag && !s.PerformedAt.Before(painSince) {
			pain = true
		}
		for id, es := range summarize(s) {
			byExercise[id] = append(byExercise[id], es)
		}
	}

	r := Report{Pain: pain, Disclaimer: Disclaimer, Exercises: []ExerciseReport{}}
	for id, hist := range byExercise {
		// Newest first; same-day sessions keep input order.
		sort.SliceStable(hist, func(i, j int) bool { return hist[i].date.After(hist[j].date) })
		var fs []Finding
		if f, ok := weightJump(hist, isLowerBody[id], cfg); ok {
			fs = append(fs, f)
		}
		if f, ok := volumeSpike(hist, today, cfg); ok {
			fs = append(fs, f)
		}
		if f, ok := highRPEStreak(hist, cfg); ok {
			fs = append(fs, f)
		}
		advice := AdviceProgressOK
		if len(fs) > 0 {
			advice = AdviceHold
		}
		if pain {
			fs = append(fs, Finding{
				Rule: RulePain, Level: LevelRisk,
				Message: "คุณรายงานว่ามีอาการเจ็บในช่วงนี้ ยังไม่ควรเพิ่มน้ำหนัก และควรปรึกษาแพทย์หรือนักกายภาพบำบัด",
			})
			advice = AdviceNoIncrease
		}
		if fs == nil {
			fs = []Finding{}
		}
		r.Exercises = append(r.Exercises, ExerciseReport{ExerciseID: id, Advice: advice, Findings: fs})
	}
	sort.Slice(r.Exercises, func(i, j int) bool { return r.Exercises[i].ExerciseID < r.Exercises[j].ExerciseID })
	return r
}

func summarize(s workout.Logged) map[int32]exerciseSession {
	out := map[int32]exerciseSession{}
	for _, set := range s.Sets {
		es := out[set.ExerciseID]
		es.date = s.PerformedAt
		es.topKg = max(es.topKg, set.WeightKg)
		es.volume += set.WeightKg * float64(set.Reps)
		if set.RPE != nil {
			es.maxRPE = max(es.maxRPE, *set.RPE)
		}
		out[set.ExerciseID] = es
	}
	return out
}

// weightJump compares the top set of the last two sessions of the exercise.
func weightJump(hist []exerciseSession, lowerBody bool, cfg Config) (Finding, bool) {
	if len(hist) < 2 || hist[1].topKg <= 0 {
		return Finding{}, false
	}
	limit := cfg.UpperBodyJumpPct
	if lowerBody {
		limit = cfg.LowerBodyJumpPct
	}
	pct := (hist[0].topKg - hist[1].topKg) / hist[1].topKg * 100
	if pct <= limit {
		return Finding{}, false
	}
	return Finding{
		Rule: RuleWeightJump, Level: LevelCaution, Value: pct,
		Message: fmt.Sprintf("น้ำหนัก top set เพิ่มขึ้น %.0f%% จากครั้งก่อน (แนะนำไม่เกิน %.0f%%) ลองคงน้ำหนักนี้ไว้ก่อนจนฟอร์มนิ่ง", pct, limit),
	}, true
}

// volumeSpike compares the last AcuteDays of volume with the weekly average
// of the ChronicWeeks before it.
func volumeSpike(hist []exerciseSession, today time.Time, cfg Config) (Finding, bool) {
	acuteStart := today.AddDate(0, 0, -cfg.AcuteDays+1) // today counts as day 1
	chronicStart := acuteStart.AddDate(0, 0, -7*cfg.ChronicWeeks)
	var acute, chronic float64
	for _, h := range hist {
		switch {
		case !h.date.Before(acuteStart):
			acute += h.volume
		case !h.date.Before(chronicStart):
			chronic += h.volume
		}
	}
	chronic /= float64(cfg.ChronicWeeks)
	if chronic <= 0 || acute <= 0 {
		return Finding{}, false
	}
	ratio := acute / chronic
	level := Level("")
	switch {
	case ratio > cfg.VolumeRisk:
		level = LevelRisk
	case ratio > cfg.VolumeCaution:
		level = LevelCaution
	default:
		return Finding{}, false
	}
	return Finding{
		Rule: RuleVolumeSpike, Level: level, Value: ratio,
		Message: fmt.Sprintf("ปริมาณการซ้อมสัปดาห์นี้สูงเป็น %.1f เท่าของค่าเฉลี่ย %d สัปดาห์ก่อนหน้า ควรเพิ่มปริมาณทีละน้อย", ratio, cfg.ChronicWeeks),
	}, true
}

// highRPEStreak fires when the most recent sessions were all near maximal.
func highRPEStreak(hist []exerciseSession, cfg Config) (Finding, bool) {
	if len(hist) < cfg.HighRPESessions {
		return Finding{}, false
	}
	for _, h := range hist[:cfg.HighRPESessions] {
		if h.maxRPE < cfg.HighRPE {
			return Finding{}, false
		}
	}
	return Finding{
		Rule: RuleHighRPEStreak, Level: LevelCaution, Value: float64(cfg.HighRPESessions),
		Message: fmt.Sprintf("%d ครั้งล่าสุดใกล้สุดแรง (RPE %.0f ขึ้นไป) แนะนำคงน้ำหนักเดิมไว้ก่อน", cfg.HighRPESessions, cfg.HighRPE),
	}, true
}
