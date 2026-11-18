package main

import (
	"testing"

	"github.com/thakornt/rep-right/apps/api/internal/config"
	apihttp "github.com/thakornt/rep-right/apps/api/internal/http"
)

func TestLimitsOverrideOnlyWhatIsSet(t *testing.T) {
	def := apihttp.DefaultLimits()
	if got := limits(config.Limits{}); got != def {
		t.Errorf("no env: %+v, want defaults %+v", got, def)
	}
	got := limits(config.Limits{AuthPerMinute: 40, UserBurst: 80, MaxInFlight: 250})
	want := def
	want.Auth.PerMinute, want.PerUser.Burst, want.MaxInFlight = 40, 80, 250
	if got != want {
		t.Errorf("got %+v, want %+v", got, want)
	}
}
