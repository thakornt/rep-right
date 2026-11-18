package http

import (
	"context"
	"sync"
	"time"

	"github.com/thakornt/rep-right/apps/api/internal/domain/workout"
)

// exerciseTTL: the exercise list only changes with a migration (a deploy).
const exerciseTTL = 5 * time.Minute

// exerciseCache keeps the exercise list in memory, so the public
// /v1/exercises and the slug lookups behind "same as last time" do not hit
// the database on every request.
type exerciseCache struct {
	Workouts
	now func() time.Time

	mu      sync.Mutex
	list    []workout.Exercise
	fetched time.Time
}

func newExerciseCache(w Workouts, now func() time.Time) *exerciseCache {
	return &exerciseCache{Workouts: w, now: now}
}

func (c *exerciseCache) ListExercises(ctx context.Context) ([]workout.Exercise, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.list != nil && c.now().Sub(c.fetched) < exerciseTTL {
		return c.list, nil
	}
	list, err := c.Workouts.ListExercises(ctx)
	if err != nil {
		return nil, err
	}
	c.list, c.fetched = list, c.now()
	return list, nil
}

func (c *exerciseCache) ExerciseBySlug(ctx context.Context, slug string) (workout.Exercise, error) {
	list, err := c.ListExercises(ctx)
	if err != nil {
		return workout.Exercise{}, err
	}
	for _, e := range list {
		if e.Slug == slug {
			return e, nil
		}
	}
	return workout.Exercise{}, workout.ErrNotFound
}
