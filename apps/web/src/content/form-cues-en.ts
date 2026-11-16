// English form cues, following form-cues.ts (the Thai source) slug by slug and
// option by option. form-cues.test.ts checks nothing is missing.

import type { Locale } from "../lib/i18n/locale";
import {
  BARBELL_SQUAT_BARS,
  FORM_CUES,
  LAT_PULLDOWN_GRIPS,
  OVERHEAD_EXTENSION_TOOLS,
  OVERHEAD_PRESS_WAYS,
  PULL_UP_GRIPS,
  UPRIGHT_ROW_TOOLS,
  type FormCues,
} from "./form-cues";

export const FORM_CUES_EN: Record<string, FormCues> = {
  "barbell-squat": {
    cues: [
      "Rest the bar on the muscles of your upper back. Feet about shoulder-width apart, toes turned out a little.",
      "Breathe in and brace your stomach before going down, then sit down with your knees pointing the same way as your toes.",
      "Go only as deep as your back stays straight, then push the floor away with your whole foot, keeping the bar over the middle of your foot the whole time.",
    ],
    mistakes: ["Knees caving in toward each other on the way up", "Heels lifting, or leaning the body too far forward"],
  },
  "dumbbell-squat": {
    cues: [
      "Hold the dumbbells at your sides with your arms hanging loose. Feet about shoulder-width apart, toes turned out a little.",
      "Brace your stomach and sit down with a straight back and knees following your toes, until your hips are a little below your knees, or as far as your heels stay down.",
      "Push the floor away with your whole foot until you're standing tall.",
    ],
    mistakes: ["Knees caving in", "Letting your back round as the dumbbells pull you forward"],
  },
  deadlift: {
    cues: [
      "Bar over the middle of your foot, hands on the bar just outside your knees, shins touching the bar.",
      "Pull the slack out of the bar before lifting: back straight, chest open, stomach braced.",
      "Push the floor away with your legs, dragging the bar up close to your legs, then push your hips forward until you're standing tall.",
    ],
    mistakes: ["Back rounding as the bar leaves the floor", "Bar drifting away from your body, or leaning back too far at the top"],
  },
  "romanian-deadlift": {
    cues: [
      "Stand tall, bend your knees slightly and keep them at that angle.",
      "Push your hips back and let the dumbbells (or bar) slide down close to your thighs, back straight.",
      "Go down until you feel a stretch in the back of your thighs, then push your hips forward to stand tall again.",
    ],
    mistakes: ["Rounding your back to go lower", "Bending the knees so much it turns into a squat"],
  },
  "hip-thrust": {
    cues: [
      "Rest your upper back against a bench with the bar across your hips and your feet about hip-width apart.",
      "Push your hips up until your body is level with the floor, and squeeze your glutes there for a moment.",
      "Tuck your chin slightly. Keep your body and ribs from arching.",
    ],
    mistakes: ["Arching the lower back instead of straightening the hips", "Feet so far away that the back of the thighs works instead of the glutes"],
  },
  "leg-extension": {
    cues: [
      "Adjust the seat so your knees line up with the machine's pivot.",
      "Straighten your legs until they're almost straight, and squeeze the front of your thighs there.",
      "Lower slowly, in control.",
    ],
    mistakes: ["Kicking up with momentum", "Lifting your bottom off the seat"],
  },
  "leg-curl": {
    cues: [
      "Set the machine so your knees line up with the pivot and the pad sits just above your ankles.",
      "Bend your knees to pull your heels toward your bottom, keeping your hips on the pad.",
      "Let the weight back slowly until your legs are almost straight.",
    ],
    mistakes: ["Lifting your hips or twisting to help pull", "Letting the weight drop quickly"],
  },
  "calf-raise": {
    cues: [
      "Stand on an edge so your heels can drop below your toes.",
      "Rise all the way up on your toes and hold for a moment.",
      "Lower your heels slowly until you feel a stretch in your calves.",
    ],
    mistakes: ["Bouncing quickly without using the full range of movement", "Bending the knees to help push"],
  },
  "bench-press": {
    cues: [
      "Lie with your eyes under the bar. Squeeze your shoulder blades together and down, feet planted firmly on the floor.",
      "Lower the bar to touch the lower part of your chest, elbows at about 45–70 degrees from your body.",
      "Press the bar up until your arms are straight, shoulder blades still squeezed.",
    ],
    mistakes: ["Elbows flared out to 90 degrees", "Bottom lifting off the bench, or bouncing the bar off your chest"],
  },
  "machine-chest-press": {
    cues: [
      "Adjust the seat so the handles are level with the middle of your chest.",
      "Squeeze your shoulder blades, upper back and bottom against the pad (a natural gap at the lower back is fine), and press out until your arms are almost straight.",
      "Come back slowly until you feel a stretch in your chest.",
    ],
    mistakes: ["Shoulders rolling forward at the end of the press", "Letting the weight slam back"],
  },
  "incline-dumbbell-press": {
    cues: [
      "Set the bench to about 30 degrees. Head, upper back and bottom on the pad; squeeze your shoulder blades and keep them there. A natural gap at the middle and lower back is fine.",
      "Turn your palms slightly toward you and let your elbows move away from your body. Lower the dumbbells beside your chest, around nipple level, until they're nearly level with your chest, as far as your shoulders stay comfortable.",
      "Press up in a straight line angled over your upper chest, bringing them only slightly together. They don't need to touch.",
    ],
    mistakes: ["Setting the bench so steep it becomes a shoulder exercise", "Lowering so deep the shoulders lose their position"],
  },
  "push-up": {
    cues: [
      "Hands a little wider than your shoulders, body straight from head to heels.",
      "Brace your stomach and glutes, and lower your chest until it nearly touches the floor, elbows at about 45 degrees.",
      "Push the floor away until your arms are straight.",
    ],
    mistakes: ["Hips sagging or bottom sticking up", "Not going all the way down"],
  },
  "overhead-press": {
    cues: [
      "Hold the bar a little wider than your shoulders, resting it on the front of your shoulders.",
      "Brace your stomach and glutes, and press the bar straight up, moving your head out of its way.",
      "Lock your arms overhead with the bar over the middle of your feet.",
    ],
    mistakes: ["Arching the lower back a lot to press up", "Pressing the bar forward instead of straight up"],
  },
  "barbell-row": {
    cues: [
      "Lean forward to about 45 degrees with a straight back and slightly bent knees.",
      "Pull the bar toward your lower stomach, squeezing your shoulder blades together.",
      "Lower slowly until your arms are straight, without moving your body.",
    ],
    mistakes: ["Swinging the body for momentum", "Rounded back"],
  },
  "chest-supported-row": {
    cues: [
      "Rest your chest against the pad, feet firm.",
      "Pull your elbows back and squeeze your shoulder blades for a moment.",
      "Let them go back until your arms are straight and your shoulder blades spread apart.",
    ],
    mistakes: ["Lifting your chest off the pad to swing", "Shrugging your shoulders up to your ears"],
  },
  "single-arm-dumbbell-row": {
    cues: [
      "One hand and one knee on a bench, back straight and level with the floor.",
      "Pull the dumbbell toward your hip, elbow close to your body.",
      "Lower until your arm is straight and you feel a stretch in your back.",
    ],
    mistakes: ["Twisting your body to pull higher", "Pulling toward your chest instead of your hip"],
  },
  "pull-up": {
    cues: [
      "Hold the bar with palms facing away, a little wider than your shoulders. Hang with straight arms and let your shoulders and body stretch out fully.",
      "First press your shoulders down toward your back pockets, then pull your elbows down to your sides and your chest toward the bar until your chin clears it.",
      "Lower yourself slowly, over 4–5 seconds, until your arms are straight.",
    ],
    mistakes: [
      "Shrugging your shoulders up to your ears at the top",
      "Swinging your legs or dropping down hard so your body sways",
      "Tipping your head or pushing your chin forward to get it over the bar",
    ],
  },
  "lat-pulldown": {
    cues: [
      "Hold the bar wider than your shoulders, thumbs just resting on the bar on the same side as your fingers. Lock your thighs firmly under the pad.",
      "Start almost upright, then lean back as you pull the bar down to your collarbone or upper chest, bringing your elbows forward and down.",
      "Let it back up slowly until your arms are almost straight and you feel a stretch.",
    ],
    mistakes: ["Pulling the bar down behind your neck", "Driving your elbows behind you at the bottom", "Leaning far back to use your body weight"],
  },
  shrug: {
    cues: [
      "Hold the weights at your sides with straight arms.",
      "Lift your shoulders straight up toward your ears and hold for a moment.",
      "Lower your shoulders slowly all the way down.",
    ],
    mistakes: ["Rolling the shoulders in circles", "Bending the elbows to help pull"],
  },
  "face-pull": {
    cues: [
      "Set the pulley a little higher than your head and use the rope, palms facing down. Step back one or two steps and lean back slightly against the pull of the cable.",
      "Pull the middle of the rope toward your forehead with your elbows at shoulder height, then spread your hands wide beside your head, like flexing both arms.",
      "Squeeze your shoulder blades there. Pull quickly as you breathe out, then let it back slowly as you breathe in.",
    ],
    mistakes: [
      "Elbows dropping below your hands, so it turns into a hammer curl (an arm bend with thumbs up)",
      "Using so much weight you have to swing your body to pull",
    ],
  },
  "single-arm-cable-rear-delt-fly": {
    cues: [
      "Set the cable at shoulder height and hold the handle with the opposite hand.",
      "Sweep your arm out to the side in a wide arc, elbow slightly bent and kept there.",
      "Stop in line with your body, then let it back slowly.",
    ],
    mistakes: ["Twisting your body to swing it", "Squeezing your shoulder blades instead of using the back of your shoulder"],
  },
  "dumbbell-lateral-raise": {
    cues: [
      "Bend your knees slightly, push your bottom back and lean forward a little with a straight back. Hold the dumbbells at your sides with elbows slightly bent.",
      "Raise your arms out to the sides and slightly forward, elbows leading your hands, until your elbows are about shoulder height.",
      "Lower slowly, in control.",
    ],
    mistakes: ["Swinging your body to lift", "Shrugging your shoulders up to your ears"],
  },
  "cable-lateral-raise": {
    cues: [
      "Stand side-on to the machine and hold the low cable handle with your far hand.",
      "Raise your arm out to the side until it's about shoulder height.",
      "Lower slowly, keeping the cable tight the whole time.",
    ],
    mistakes: ["Leaning too far away from the machine", "Shrugging your shoulders up to your ears"],
  },
  "incline-dumbbell-lateral-raise": {
    cues: [
      "Lie on your side on an incline bench, or face down on it, depending on the version you do.",
      "Raise the dumbbell out to the side until it's about shoulder height, elbow slightly bent.",
      "Lower slowly, in control the whole way.",
    ],
    mistakes: ["Using so much weight you swing it", "Raising above shoulder height until the shoulder feels pinched"],
  },
  "upright-row": {
    cues: [
      "Hold the bar with palms facing you, a fair bit wider than your shoulders. Stand with knees slightly bent, leaning forward a little with a straight back.",
      "Raise your elbows out to the sides, angled just slightly forward, until your upper arms are almost level with the floor: elbows at shoulder height, no higher. Pull the bar up close to your body to chest level, without swinging it forward.",
      "Lower slowly until your arms are straight. Breathe out as you pull up, in as you lower.",
    ],
    mistakes: [
      "Raising the elbows above shoulder height until the shoulder feels pinched",
      "Swinging the weight forward so it turns into a front raise (lifting straight arms in front of you)",
      "Swinging your body or leaning back to help pull",
    ],
  },
  "dumbbell-curl": {
    cues: [
      "Stand tall, elbows by your sides, palms facing forward.",
      "Bend your elbows to lift the dumbbells all the way up, squeezing your biceps.",
      "Lower slowly until your arms are almost straight.",
    ],
    mistakes: ["Elbows sliding forward, or swinging your body", "Not lowering all the way"],
  },
  "hammer-curl": {
    cues: [
      "Hold the dumbbells with palms facing your body, elbows by your sides.",
      "Bend your elbows to lift, keeping your wrists steady.",
      "Lower slowly until your arms are almost straight.",
    ],
    mistakes: ["Swinging your body to lift", "Turning your wrists during the lift"],
  },
  "incline-dumbbell-curl": {
    cues: [
      "Sit back on a bench inclined to about 45–60 degrees, arms hanging straight down at your sides.",
      "Bend your elbows to lift the dumbbells without your upper arms moving forward.",
      "Lower slowly until your arms are straight and you feel a stretch in your biceps.",
    ],
    mistakes: ["Shoulders lifting off the bench", "Using so much weight you can't lower all the way"],
  },
  "cable-curl": {
    cues: [
      "Stand facing a low cable, elbows by your sides.",
      "Bend your elbows to pull the handle all the way up.",
      "Lower slowly, keeping the cable tight the whole time.",
    ],
    mistakes: ["Leaning back to help pull", "Elbows sliding forward"],
  },
  "rope-triceps-pushdown": {
    cues: [
      "Stand facing a high cable holding the rope, upper arms hanging still, elbows by your sides.",
      "Push the rope down until your arms are almost straight in one line, wrists under your shoulders.",
      "Let it back up slowly, elbows staying where they are.",
    ],
    mistakes: ["Elbows flaring or sliding up and down", "Leaning over to push down with your body weight"],
  },
  "overhead-triceps-extension": {
    cues: [
      "Hold one dumbbell overhead with both hands, sitting or standing with your body upright.",
      "Lower the dumbbell behind your head, elbows pointing up and close to your head.",
      "Straighten your arms back up.",
    ],
    mistakes: ["Elbows flaring wide", "Arching your back to press up"],
  },
  crunch: {
    cues: [
      "Lie on your back with knees bent and feet flat on the floor. Fingertips lightly touch your temples, elbows open toward the front of your body.",
      "Curl your upper back up until your shoulder blades leave the floor, lower back staying on the floor.",
      "Go down slowly, then start the next one without swinging.",
    ],
    mistakes: ["Lacing your fingers and pulling on your neck", "Sitting all the way up so your lower back leaves the floor"],
  },
  "cable-crunch": {
    cues: [
      "Kneel in front of a high cable, holding the rope beside your head.",
      "Curl your body down using your stomach, bringing your elbows toward your thighs.",
      "Come back up slowly, hips staying where they are.",
    ],
    mistakes: ["Sitting back with your hips instead of curling your body", "Pulling the rope with your arms"],
  },
  "leg-raise": {
    cues: [
      "Lie on your back or hang from a bar, bracing your stomach so your lower back doesn't arch.",
      "Raise your legs in control, curling your hips up slightly at the top.",
      "Lower your legs slowly, without your lower back arching.",
    ],
    mistakes: ["Swinging your legs with momentum", "Lower back arching as you lower your legs"],
  },
};

type Way = { key: string; label: string; form: FormCues };

// The options on some exercises' pages, in the same order as the Thai lists.
const WAYS_EN = new Map<Way[], Way[]>([
  [
    LAT_PULLDOWN_GRIPS,
    [
      { key: "wide", label: "Wide, palms away", form: FORM_CUES_EN["lat-pulldown"] },
      {
        key: "neutral",
        label: "Palms facing",
        form: {
          cues: [
            "Use the handle with palms facing each other, and lock your thighs under the pad.",
            "Pull the handle down to your upper chest, elbows close to your body.",
            "Let it back up slowly until your arms are straight.",
          ],
          mistakes: ["Shrugging your shoulders up as it goes back", "Swinging your body for momentum"],
        },
      },
      {
        key: "single",
        label: "One arm",
        form: {
          cues: [
            "Hold a single handle, sitting or kneeling so your body is steady.",
            "Pull your elbow down toward your hip, twisting your body as little as possible.",
            "Let it back up until your arm is straight and you feel a stretch down your side.",
          ],
          mistakes: ["Twisting your body a lot to help pull", "Pulling with your arm instead of bringing the elbow down"],
        },
      },
    ],
  ],
  [
    PULL_UP_GRIPS,
    [
      { key: "overhand", label: "Palms away", form: FORM_CUES_EN["pull-up"] },
      {
        key: "underhand",
        label: "Palms toward you (chin-up)",
        form: {
          cues: [
            "Hold the bar with palms facing you, about shoulder-width apart. Hang with straight arms and let your shoulders and body stretch out fully.",
            "First press your shoulders down toward your back pockets, then pull your elbows down in front of your body, upper arms coming in to your ribs, until your chin clears the bar.",
            "Lower yourself slowly, over 4–5 seconds, until your arms are straight.",
          ],
          mistakes: [
            "Holding wider than your shoulders with palms toward you, which strains the wrists and elbows",
            "Shrugging your shoulders up to your ears at the top",
            "Swinging your legs or dropping down hard so your body sways",
          ],
        },
      },
    ],
  ],
  [
    BARBELL_SQUAT_BARS,
    [
      { key: "back", label: "Bar on back", form: FORM_CUES_EN["barbell-squat"] },
      {
        key: "front",
        label: "Bar in front",
        form: {
          cues: [
            "Rest the bar on the front of your shoulders with your elbows raised, level with the floor.",
            "Keep your body more upright than with the bar on your back, stomach braced the whole time.",
            "Sit straight down, letting your knees travel forward, then push up with your elbows still high.",
          ],
          mistakes: ["Elbows dropping so the bar rolls forward", "Upper back rounding"],
        },
      },
    ],
  ],
  [
    OVERHEAD_PRESS_WAYS,
    [
      {
        key: "seated",
        label: "Seated",
        form: {
          cues: [
            "Sit back against a slightly reclined backrest. The dumbbells start just above the front of your shoulders, elbows tucked slightly forward, forearms upright.",
            "Press straight up overhead until your arms are almost straight.",
            "Lower slowly back above the front of your shoulders, elbows not flaring straight out to the sides. Keep your upper back and bottom on the pad; a natural gap at the lower back is fine.",
          ],
          mistakes: [
            "Arching the lower back so much your upper back comes off the pad",
            "Lowering the dumbbells so far your shoulders feel strained or painful",
          ],
        },
      },
      { key: "standing", label: "Standing", form: FORM_CUES_EN["overhead-press"] },
    ],
  ],
  [
    OVERHEAD_EXTENSION_TOOLS,
    [
      { key: "dumbbell", label: "Dumbbell", form: FORM_CUES_EN["overhead-triceps-extension"] },
      {
        key: "cable",
        label: "Cable",
        form: {
          cues: [
            "Set the pulley at about belly-button height with the rope attached. Hold the rope ends, turn your back to the machine and lift the rope up behind your head. Stand tall.",
            "Upper arms up beside your head, elbows pointing up and tucked in, then straighten your arms until they're almost straight, hands coming close together overhead, breathing out.",
            "Lower slowly, hands going behind your head until you feel a stretch in the back of your arms, breathing in. Elbows stay where they are.",
          ],
          mistakes: [
            "Elbows flaring out to the sides as you lower",
            "Setting the pulley high so you have to lean and twist to get into position, or at the very bottom so you have to bend down to pick it up",
            "Arching your lower back, or letting the weight drop too fast to control",
          ],
        },
      },
    ],
  ],
  [
    UPRIGHT_ROW_TOOLS,
    [
      { key: "barbell", label: "Barbell", form: FORM_CUES_EN["upright-row"] },
      {
        key: "dumbbell",
        label: "Dumbbells",
        form: {
          cues: [
            "Hold the dumbbells with palms facing you, a little wider than your shoulders; your palms can turn in slightly. Stand with knees slightly bent, leaning forward a little with a straight back.",
            "Raise your elbows out to the sides, angled just slightly forward, until your upper arms are almost level with the floor: elbows at shoulder height, no higher. Pull the dumbbells up close to your body to chest level, without swinging them forward or letting your hands drift out to the sides.",
            "Lower slowly until your arms are straight. Breathe out as you pull up, in as you lower.",
          ],
          mistakes: [
            "Raising the elbows above shoulder height until the shoulder feels pinched",
            "Swinging the weight forward so it turns into a front raise (lifting straight arms in front of you)",
            "Swinging your body or leaning back to help pull",
          ],
        },
      },
    ],
  ],
]);

/** An exercise's form cues in the given language; undefined for an unknown slug. */
export function formCues(slug: string, locale: Locale): FormCues | undefined {
  if (!(slug in FORM_CUES)) return undefined;
  return locale === "en" ? FORM_CUES_EN[slug] : FORM_CUES[slug];
}

/** One of the option lists from form-cues.ts in the given language, same keys and order. */
export function localizedWays(list: Way[], locale: Locale): Way[] {
  return locale === "en" ? (WAYS_EN.get(list) ?? list) : list;
}

/** For the tests: every option list with its English version. */
export const WAYS_FOR_TEST = WAYS_EN;
