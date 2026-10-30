// Package returnplan builds a conservative plan for returning to an exercise
// after a break: start lighter, then ramp back to the old top set week by
// week. It is pure.
package returnplan

import (
	"math"
	"time"
)

// Tier is one row of the break-length table. Tiers are checked in order and
// the first with DaysOff below MaxDaysOff applies.
type Tier struct {
	MaxDaysOff  int     // exclusive; 0 = no upper bound
	StartPctMin float64 // percent of the old top set
	StartPctMax float64
	RampWeeks   int
}

type Config struct {
	Tiers     []Tier
	RoundToKg float64 // weights are rounded down to a multiple of this
}

func DefaultConfig() Config {
	return Config{
		Tiers: []Tier{
			{MaxDaysOff: 7, StartPctMin: 100, StartPctMax: 100, RampWeeks: 0},
			{MaxDaysOff: 14, StartPctMin: 90, StartPctMax: 90, RampWeeks: 1},
			{MaxDaysOff: 28, StartPctMin: 80, StartPctMax: 80, RampWeeks: 2},
			{MaxDaysOff: 56, StartPctMin: 70, StartPctMax: 70, RampWeeks: 3},
			{MaxDaysOff: 0, StartPctMin: 50, StartPctMax: 60, RampWeeks: 4},
		},
		RoundToKg: 2.5,
	}
}

type Step struct {
	Week     int // 1 = first week back
	Percent  float64
	WeightKg float64
}

type Plan struct {
	DaysOff     int
	Needed      bool // false when the break was too short to matter
	TopKg       float64
	StartPctMin float64
	StartPctMax float64
	StartKg     float64 // from StartPctMin: the safe end of the range
	RampWeeks   int
	Steps       []Step // RampWeeks steps, then a final step back at 100%
}

// For plans the return to one exercise last done on lastDate with a top set
// of topKg. Dates are UTC days.
func For(lastDate time.Time, topKg float64, today time.Time, cfg Config) Plan {
	daysOff := int(today.Sub(lastDate).Hours() / 24)
	tier := cfg.Tiers[len(cfg.Tiers)-1]
	for _, t := range cfg.Tiers {
		if t.MaxDaysOff == 0 || daysOff < t.MaxDaysOff {
			tier = t
			break
		}
	}

	p := Plan{
		DaysOff:     daysOff,
		Needed:      tier.RampWeeks > 0,
		TopKg:       topKg,
		StartPctMin: tier.StartPctMin,
		StartPctMax: tier.StartPctMax,
		StartKg:     roundDown(topKg*tier.StartPctMin/100, cfg.RoundToKg),
		RampWeeks:   tier.RampWeeks,
		Steps:       []Step{},
	}
	if !p.Needed {
		return p
	}
	// Linear ramp: week k of n is start + (100-start)*(k-1)/n, then 100%.
	for k := 1; k <= tier.RampWeeks+1; k++ {
		pct := tier.StartPctMin + (100-tier.StartPctMin)*float64(k-1)/float64(tier.RampWeeks)
		p.Steps = append(p.Steps, Step{Week: k, Percent: pct, WeightKg: roundDown(topKg*pct/100, cfg.RoundToKg)})
	}
	return p
}

func roundDown(kg, step float64) float64 {
	if step <= 0 {
		return kg
	}
	// The epsilon keeps exact multiples (e.g. 90.0000001) from dropping a step.
	return math.Floor(kg/step+1e-9) * step
}
