// English copy for the dumbbell, cable and floor viewer, following PRESS_CONTENT
// in press.ts (the Thai source) exercise by exercise. press-en.test.ts checks
// nothing is missing.

import type { Locale } from "@/lib/i18n/locale";

import { PRESS_CONTENT, type PressExercise } from "./press";

type PressContent = (typeof PRESS_CONTENT)[PressExercise];

const STOP_SHOULDER_ELBOW_WRIST =
  "If you feel a sharp or unusual pain in your shoulder, elbow or wrist, stop right away and talk to a professional.";
const NOT_EXACT = "Everybody's body is different, so";

const PULL_UP_GRIP_NOTES = [
  {
    label: "Palms away (pull-up)",
    text: "Palms face away, hands a little wider than your shoulders, elbows coming down to your sides. Your back and lats do most of the work and the front of your arms helps less, so it's harder. Good for building back strength directly.",
  },
  {
    label: "Palms toward you (chin-up)",
    text: "Palms face you, hands about shoulder-width apart, elbows coming down in front of your body. Your back works together with the front of your arms (biceps), which help more, so it's easier. Good for people starting to learn pull-ups.",
  },
];

const PULLDOWN_TOP_BOTTOM = {
  top: "Fully up",
  bottom: "Pulled all the way down",
  rising: "Letting it up",
  lowering: "Pulling down",
};

const PULL_UP_TOP_BOTTOM = {
  top: "Hanging, fully stretched",
  bottom: "Pulled all the way up",
  rising: "Lowering down",
  lowering: "Pulling up",
};

const PULL_UP_FEET =
  "Bend your knees so your shins point back, legs together and still. If the bar is high enough you can keep your legs straight, but don't kick or swing them to help you pull.";
const PULL_UP_BACK =
  "When hanging, let your shoulders and body stretch out fully, then press your shoulders down toward your back pockets before you start pulling. On the way up, lean back slightly and bring your chest toward the bar.";
const PULL_UP_CORE =
  "Take a breath in before you pull and brace your stomach so your body stays still. Pull up until your chin clears the bar with your neck straight, not pushing your chin forward or dropping your head, then lower slowly over 4–5 seconds.";

const UPRIGHT_ROW_FEET = "Stand with feet about hip-width apart, knees slightly bent, hips pushed back a little.";
const UPRIGHT_ROW_BACK =
  "Lean your whole body forward a little with a straight back, shoulders not rolled forward, looking straight ahead. Keep your body still the whole time, without swinging to help pull.";
const UPRIGHT_ROW_ELBOW =
  "Raise your upper arms in one line out to the sides, angled just slightly forward, until they're almost level with the floor: elbows at shoulder height, no higher, bending more as you go.";
const UPRIGHT_ROW_CORE = "Breathe out as you pull up, lower slowly as you breathe in, and brace your stomach to keep your body still.";

export const PRESS_CONTENT_EN: Record<PressExercise, PressContent> = {
  pulldownNeutral: {
    cues: {
      feet: "Sit with your feet flat on the floor. Adjust the pad so it presses firmly on your thighs with no gap: a steady lower body lets you pull with full strength.",
      back: "At the top, sit almost upright and stretch all the way up, then lean back slightly as you pull, chest lifted. Don't swing your body to help pull.",
      elbow: "Bring your elbows down in front of your body, close to your sides. Don't flare them out or drive them behind you.",
      dumbbell: "Hold the parallel handle with your palms facing each other and pull it down to your upper chest.",
      core: "Brace your stomach lightly. Pull down quickly as you breathe out, then let it up slowly as you breathe in. Don't let the handle spring up.",
    },
    ...PULLDOWN_TOP_BOTTOM,
    notice: [
      `${NOT_EXACT} how far you can pull down differs. You don't have to match the model exactly.`,
      "Pull down as far as your shoulders stay comfortable and your chest stays lifted. That's the right range for you for now.",
      STOP_SHOULDER_ELBOW_WRIST,
    ],
  },
  pulldownSingle: {
    cues: {
      feet: "Sit with your feet flat on the floor. Adjust the pad so it presses firmly on your thighs, and rest your other hand on your thigh.",
      back: "Keep your body almost upright the whole time. Don't twist or lean toward the pulling side to help.",
      elbow: "Pull your elbow down to your side, close to your ribs, so your hand ends up beside your shoulder.",
      dumbbell: "Hold a single handle with your palm facing you. At the top, your arm is almost straight and you feel a stretch down your side.",
      core: "Brace your stomach to keep your body still. Pull down quickly as you breathe out, then let it up slowly as you breathe in. Finish your reps, then switch sides.",
    },
    ...PULLDOWN_TOP_BOTTOM,
    notice: [
      `${NOT_EXACT} how far you can pull down differs. You don't have to match the model exactly.`,
      "Pull down as far as your shoulders stay comfortable and your body doesn't twist. That's the right range for you for now.",
      STOP_SHOULDER_ELBOW_WRIST,
    ],
  },
  pullUp: {
    cues: {
      feet: PULL_UP_FEET,
      back: PULL_UP_BACK,
      elbow: "Pull your elbows down to your sides, pointing at the floor and slightly out. Don't shrug your shoulders up to your ears at the top.",
      dumbbell: "Hold the bar with palms facing away, a little wider than your shoulders, wrapping your hand around it normally. Don't wrap too far behind the bar, and don't let your wrists sink under it.",
      core: PULL_UP_CORE,
    },
    ...PULL_UP_TOP_BOTTOM,
    notice: [
      `${NOT_EXACT} the hand width that feels comfortable can differ. You don't have to match the model exactly.`,
      "If you can't pull up yet, start by hanging and practising pressing your shoulders down, or get to the top and lower yourself slowly.",
      STOP_SHOULDER_ELBOW_WRIST,
    ],
    grips: PULL_UP_GRIP_NOTES,
  },
  chinUp: {
    cues: {
      feet: PULL_UP_FEET,
      back: PULL_UP_BACK,
      elbow: "Pull your elbows down in front of your body, upper arms coming in to your ribs. Don't flare your elbows out, and don't shrug your shoulders up to your ears at the top.",
      dumbbell: "Hold the bar with palms facing you, about shoulder-width apart, no wider. Holding wide with palms toward you strains the wrists and elbows.",
      core: PULL_UP_CORE,
    },
    ...PULL_UP_TOP_BOTTOM,
    notice: [
      `${NOT_EXACT} the hand width that feels comfortable can differ. You don't have to match the model exactly.`,
      "If your wrists or elbows feel strained with palms toward you, move your hands slightly in or out until it's comfortable, or switch to palms away.",
      STOP_SHOULDER_ELBOW_WRIST,
    ],
    grips: PULL_UP_GRIP_NOTES,
  },
  hipThrust: {
    cues: {
      feet: "Feet flat on the floor, about hip-width apart, toes turned out a little. Place them so your shins are upright at the top, not tilted forward or back.",
      back: "Rest your upper back, just below the shoulder blades, on the edge of the bench. Keep your back in one straight line the whole time, without arching your lower back at the top. Tuck your chin slightly and look ahead.",
      elbow: "Elbows bent down at your sides. Your hands only steady the bar so it doesn't roll; your arms don't push.",
      dumbbell: "Rest the bar in the crease of your hips with a bar pad, hands a little wider than your hips.",
      core: "Drive your hips up quickly as you breathe out, until your shoulders, hips and knees are in one line. Squeeze your glutes for a moment, then lower slowly as you breathe in, as far as your knees can still bend more. Your back stays on the same spot on the bench, without sliding up and down.",
    },
    top: "Pushed all the way up",
    bottom: "All the way down",
    rising: "Pushing up",
    lowering: "Lowering",
    notice: [
      `${NOT_EXACT} the right bench height differs. Adjust where your feet go so your shins are upright at the top.`,
      "Go down as far as your back stays straight and your bottom doesn't hit the floor. That's the right range for you for now.",
      "If you feel a sharp or unusual pain in your lower back or hips, stop right away and talk to a professional.",
    ],
  },
  legExtension: {
    cues: {
      feet: "Set the shin pad on the lower part of your shins, just above the ankles. At the start, your knees should be bent at least 90 degrees.",
      back: "Sit with your back against the backrest and pull yourself into the seat so your bottom stays down. Don't lift your bottom as you straighten your legs.",
      elbow: "Move the seat in or out until your knees line up with the machine's pivot (the round point the arm turns around).",
      dumbbell: "Grip the handles beside the seat firmly and use them to pull yourself into the seat.",
      core: "Straighten your legs quickly as you breathe out, until they're almost straight. Squeeze the front of your thighs for a moment, then lower slowly as you breathe in. Don't kick with momentum.",
    },
    top: "Legs straight",
    bottom: "Knees fully bent",
    rising: "Straightening",
    lowering: "Lowering",
    notice: [
      `${NOT_EXACT} leg lengths differ. Adjust the seat and the shin pad every time you use the machine.`,
      "Straighten your legs as far as your knees stay comfortable. No need to lock them out hard.",
      "If you feel a sharp or unusual pain in your knee, stop right away and talk to a professional.",
    ],
  },
  uprightRow: {
    cues: {
      feet: UPRIGHT_ROW_FEET,
      back: UPRIGHT_ROW_BACK,
      elbow: UPRIGHT_ROW_ELBOW,
      dumbbell: "Hold the bar with palms facing you, a fair bit wider than your shoulders. Pull it up close to your body, from the front of your thighs to chest level. Don't swing it forward like a front raise (lifting straight arms in front of you).",
      core: UPRIGHT_ROW_CORE,
    },
    top: "Pulled all the way up",
    bottom: "Lowered all the way",
    rising: "Lowering",
    lowering: "Pulling up",
    notice: [
      "A narrow grip pulled high often makes the shoulders feel stuck or sore. A wider grip and a slight forward lean help the shoulders work more comfortably.",
      "Pull up only as far as your shoulders stay comfortable. If you start to feel a pinch at the top of the shoulder, stop below that point.",
      "If you feel a sharp or unusual pain in your shoulder or neck, stop right away and talk to a professional.",
    ],
  },
  uprightRowDumbbell: {
    cues: {
      feet: UPRIGHT_ROW_FEET,
      back: UPRIGHT_ROW_BACK,
      elbow: UPRIGHT_ROW_ELBOW,
      dumbbell: "Hold the dumbbells with palms facing you, a little wider than your shoulders; you can turn your palms in slightly if that suits your wrists. Pull them up close to your body, from the front of your thighs to chest level, without swinging them forward or out to the sides.",
      core: UPRIGHT_ROW_CORE,
    },
    top: "Pulled all the way up",
    bottom: "Lowered all the way",
    rising: "Lowering",
    lowering: "Pulling up",
    notice: [
      "Holding narrow and pulling high often makes the shoulders feel stuck or sore. Holding wider and leaning forward slightly help the shoulders work more comfortably.",
      "Pull up only as far as your shoulders stay comfortable. If you start to feel a pinch at the top of the shoulder, stop below that point.",
      "If you feel a sharp or unusual pain in your shoulder or neck, stop right away and talk to a professional.",
    ],
  },
  facePull: {
    cues: {
      feet: "Set the pulley a little higher than your head, then step back one or two steps. Feet about hip-width apart, knees slightly bent, a little more weight on your heels.",
      back: "Lean back slightly in a straight line from ankles to head, to resist the cable pulling you forward, but don't swing to help pull. Chest open. At the end of the pull, squeeze your shoulder blades together.",
      elbow: "Lead with your elbows: pull them out and back at shoulder height, never lower than your hands. If your elbows drop, it turns into a hammer curl (an arm bend with thumbs up) that works the arms instead.",
      dumbbell: "Hold the rope with palms facing down. Pull the middle of the rope in as if to touch your forehead, then spread your hands as wide as you can beside your head, forearms upright, like flexing both arms.",
      core: "Pull in quickly as you breathe out, then resist slowly on the way back as you breathe in. Brace your stomach to keep your body still. Use a weight that lets you keep good form and feel it in the back of your shoulders first.",
    },
    top: "Arms out",
    bottom: "Pulled all the way in",
    rising: "Letting it back",
    lowering: "Pulling in",
    notice: [
      `${NOT_EXACT} shoulders turn out by different amounts. You don't need to spread your hands as wide as the model.`,
      "Pull in as far as your elbows stay at shoulder height and your shoulders stay comfortable. That's the right range for you for now.",
      "If you feel a sharp or unusual pain in your shoulder or neck, stop right away and talk to a professional.",
    ],
  },
  rdl: {
    cues: {
      feet: "Stand with feet about hip-width apart, weight from mid-foot to heel. Bend your knees just slightly and keep that angle; don't sit down into a squat.",
      back: "Keep your back in one straight line from hips to neck, neither rounded nor arched at the lower back. Chest open, shoulders not rolled forward, looking at the floor a little ahead of you.",
      elbow: "Arms hang straight like hooks; don't bend your elbows to pull. Draw your shoulders back slightly so the dumbbells stay close to your legs.",
      dumbbell: "Slide the dumbbells down the front of your legs the whole way, to about mid-shin, or as far as your back stays straight and you feel a stretch in the back of your thighs.",
      core: "Start by pushing your hips back, not by bending forward. Brace your stomach to keep your back still. Come up by driving your hips forward and squeezing your glutes, and go down slowly.",
    },
    top: "Standing tall",
    bottom: "All the way down",
    rising: "Standing up",
    lowering: "Lowering",
    notice: [
      `${NOT_EXACT} how low you can go depends on how flexible the back of your thighs is. You don't need to go as low as the model.`,
      "Go down as far as your back stays straight. If your back starts to round, that's where to stop and drive your hips back up.",
      "If you feel a sharp or unusual pain in your lower back or the back of your thighs, stop right away and talk to a professional.",
    ],
  },
  row: {
    cues: {
      feet: "The foot on the same side as your supporting hand goes forward; step the foot on the dumbbell side straight back. Both feet flat on the floor, knees slightly bent, so you're steady and don't rock.",
      back: "Hinge at the hips so your body leans low, back in one straight line, looking at the floor a little ahead. Don't stand upright, or you'll pull with your upper traps instead of your back.",
      elbow: "Pull your elbow back toward your hip, upper arm close to your side; don't flare it out. At the bottom, let your arm hang almost straight but don't lock the elbow.",
      dumbbell: "Palm facing your body, forearm hanging straight down the whole way. The dumbbell moves in an arc from under your shoulder toward your hip; don't yank it straight up to your chest.",
      core: "Brace firmly with your other hand. Tighten your stomach so your body doesn't twist open with the pulling arm. Pull up faster than you lower, then lower slowly.",
    },
    top: "Pulled all the way up",
    bottom: "Lowered all the way",
    rising: "Pulling up",
    lowering: "Lowering",
    notice: [
      `${NOT_EXACT} the height of your support and how far you step back can differ. You don't have to match the model exactly.`,
      "Pull as far as your back stays straight and your body doesn't twist. That's the right range for you for now.",
      "If you feel a sharp or unusual pain in your lower back, shoulder or elbow, stop right away and talk to a professional.",
    ],
  },
  overheadOne: {
    cues: {
      feet: "Stand with feet about hip-width apart, weight on your whole foot. Rest your free hand on your waist to help keep your body still.",
      back: "Stand tall. Don't arch your lower back as you press up, and don't lean toward the lifting side.",
      elbow: "Raise your upper arm so your shoulder and elbow line up as straight as your shoulder allows; if your shoulder feels tight, the elbow can angle out a little. The elbow stays put as the pivot. At the top, your arm is almost straight but not locked.",
      dumbbell: "Lower the dumbbell diagonally behind you toward the other side: lifting with the right arm, it goes down behind you to the left. Go down only as far as the dumbbell doesn't touch your neck or back.",
      core: "Brace your stomach lightly and keep your ribs from flaring. Press up faster than you lower, then lower slowly.",
    },
    top: "Pressed all the way up",
    bottom: "Lowered all the way",
    rising: "Pressing up",
    lowering: "Lowering",
    notice: [
      `${NOT_EXACT} shoulders raise straight up by different amounts. You don't have to match the model exactly.`,
      "Lower as far as your elbow stays in place and your shoulder stays comfortable. That's the right range for you for now.",
      "If you feel a sharp or unusual pain in your elbow, shoulder or neck, stop right away and talk to a professional.",
    ],
  },
  overheadTwo: {
    cues: {
      feet: "Stand with feet about hip-width apart, weight on your whole foot, without rocking to help press.",
      back: "Stand tall. Don't arch your lower back as you press up. Head upright; don't duck away from the dumbbell.",
      elbow: "Elbows raised high, angled naturally forward, not flared wide. The elbows stay put as the pivot. At the top, your arms don't need to be perfectly straight.",
      dumbbell: "Cup the top plate of the dumbbell from underneath with both palms together, the handle passing between the thumb and index finger of each hand. Lower it behind your head as deep as you can, taking care not to hit the back of your head or neck.",
      core: "Brace your stomach lightly and keep your ribs from flaring. Press up faster than you lower, then lower slowly.",
    },
    top: "Pressed all the way up",
    bottom: "Lowered all the way",
    rising: "Pressing up",
    lowering: "Lowering",
    notice: [
      `${NOT_EXACT} elbows bend and shoulders raise by different amounts. You don't have to match the model exactly.`,
      "Lower as far as your elbows stay in place and the dumbbell stays clear of the back of your head. That's the right range for you for now.",
      "If you feel a sharp or unusual pain in your elbow, shoulder or wrist, stop right away and talk to a professional.",
    ],
  },
  overheadCable: {
    cues: {
      feet: "Set the pulley at about belly-button height with the rope attached. Hold both rope ends, turn your back to the machine and lift the rope up behind your head. Stand about one step from the machine, feet about hip-width apart.",
      back: "Stand tall, without leaning or twisting. Don't arch your lower back as you press up. Head upright.",
      elbow: "Upper arms up beside your head, elbows pointing up and tucked in, not flared out. The elbows stay put as the pivot. At the top, your arms are almost straight but not locked.",
      dumbbell: "Grip the rope ends with palms facing each other. Lower your hands behind your head until you feel a stretch in the back of your arms, then press up until your hands come close together overhead.",
      core: "Brace your stomach lightly and keep your ribs from flaring. Breathe out as you press up, and lower slowly as you breathe in.",
    },
    top: "Pressed all the way up",
    bottom: "Lowered all the way",
    rising: "Pressing up",
    lowering: "Lowering",
    notice: [
      "With the pulley at the very bottom you have to bend down to pick it up; set high, you have to lean and twist. Belly-button height lets you turn into position more easily and safely.",
      "Lower as far as your elbows stay in place and your shoulders stay comfortable. That's the right range for you for now.",
      "If you feel a sharp or unusual pain in your elbow, shoulder or neck, stop right away and talk to a professional.",
    ],
  },
  pushup: {
    cues: {
      feet: "Toes dug into the floor, feet about hip-width apart, legs straight.",
      back: "Your body is a straight line from head to heels, back straight, hips neither sagging nor sticking up. Look at the floor a little in front of your hands.",
      elbow: "At the bottom, seen from the front, your forearms are upright with your elbows no wider than your wrists, angled back toward your feet. At the top, your arms are almost straight but not locked.",
      dumbbell: "Hands a little wider than your shoulders. At the top, seen from the side, your arms are straight under your shoulders; at the bottom your hands are around nipple level, fingers pointing forward. Seen from the front, your arms angle out slightly from shoulder to hand.",
      core: "Brace your stomach and glutes so your body is stiff like a plank. Push up quickly as you breathe out, and go down slowly as you breathe in.",
    },
    top: "Pushed all the way up",
    bottom: "All the way down",
    rising: "Pushing up",
    lowering: "Lowering",
    notice: [
      `${NOT_EXACT} hand width and how low you can go can differ. You don't have to match the model exactly.`,
      "Go down as far as your body stays in one straight line and your shoulders stay comfortable. If you can't go down yet, start with your knees on the floor or push against the edge of a table.",
      "This exercise bends your wrists back a lot. If you feel a sharp or unusual pain in your wrist, shoulder or elbow, stop right away and talk to a professional.",
    ],
  },
  crunch: {
    cues: {
      feet: "Lie on your back with knees bent, feet flat on the floor about hip-width apart. Don't let your feet lift as you come up.",
      back: "Slowly curl your upper back up until your shoulder blades leave the floor, lower back staying on the floor. No need to sit all the way up.",
      elbow: "Open your elbows toward the front of your body at about 45 degrees: not flat out, and not squeezed together as you come up.",
      dumbbell: "Palms facing your face, fingertips lightly on your temples. Don't lace your fingers and pull on your neck.",
      core: "Tighten your stomach and curl your ribs toward your hips quickly as you breathe out, then go down slowly as you breathe in. Keep about a fist's space between your chin and chest.",
    },
    top: "Curled all the way up",
    bottom: "Lying flat",
    rising: "Curling up",
    notice: [
      `${NOT_EXACT} how far you can curl up differs. You don't have to match the model exactly.`,
      "Curl up as far as your lower back stays on the floor and your neck stays comfortable. That's the right range for you for now.",
      "If you feel a sharp or unusual pain in your back or neck, stop right away and talk to a professional.",
    ],
  },
  pushdown: {
    cues: {
      feet: "Stand facing the machine, feet about hip-width apart, knees slightly bent, weight on your whole foot.",
      back: "Lean your body forward slightly with a straight back, shoulders down, not shrugged up to your ears. Hold this position the whole set; don't use your body weight to push down.",
      elbow: "Upper arms hang still with your elbows under your shoulders as the pivot, not moving forward or back. Push down in control until your arms are almost straight in one line from shoulder to wrist, without slamming the elbows. Keep your wrists under your shoulders and your arms in, then turn your elbows out slightly.",
      dumbbell: "Grip the rope above its ends, thumbs on top. On the way up, your hands come back together at chest height.",
      core: "Brace your stomach lightly to keep your body still. Push down faster than you let it up, then let it up slowly with your elbows staying in place.",
    },
    top: "Let all the way up",
    bottom: "Pushed all the way down",
    rising: "Letting it up",
    lowering: "Pushing down",
    notice: [
      `${NOT_EXACT} how high your hands come up can differ. You don't have to match the model exactly.`,
      "Let it up only as far as your elbows stay in place. If your elbows start sliding forward, that's where to stop.",
      "If you feel a sharp or unusual pain in your elbow, wrist or shoulder, stop right away and talk to a professional.",
    ],
  },
  pulldown: {
    cues: {
      feet: "Sit with your feet flat on the floor. Adjust the pad so it presses firmly on your thighs with no gap: a steady lower body lets you pull with full strength.",
      back: "At the top, sit almost upright and stretch all the way up, then lean back as you pull, chest lifted. Don't swing your body to use your weight to help pull.",
      elbow: "Bring your elbows forward and then down, keeping your forearms close to the line of the cable. Don't drive your elbows behind you.",
      dumbbell: "Hold wider than your shoulders with your thumb on the same side as your fingers, just resting on the bar and pointing up rather than wrapped around. This uses your forearms less, but always keep a secure grip.",
      core: "Brace your stomach lightly. Pull the bar down to your collarbone or upper chest, then let it up slowly. Don't let the bar spring up.",
    },
    ...PULLDOWN_TOP_BOTTOM,
    notice: [
      `${NOT_EXACT} hand width and how far you pull down can differ. You don't have to match the model exactly.`,
      "Pull down as far as your shoulders stay comfortable and your chest stays lifted. That's the right range for you for now.",
      STOP_SHOULDER_ELBOW_WRIST,
    ],
  },
  chestPress: {
    cues: {
      feet: "Sit all the way back on the seat with your feet flat on the floor, so your body stays still while you press.",
      back: "Back and head on the pad. Squeeze your shoulder blades together and down, and lock them there for the whole set. Don't let your shoulders roll forward at the end of the push.",
      elbow: "Keep your elbows behind your hands, in line with the push the whole way: not flaring out, not lifting or dropping.",
      dumbbell: "Set the seat so your hands are around nipple level at the stretch. Grip the handles with straight wrists and press out in a straight line until your arms are almost straight, without locking your elbows. A slight angle inward is fine for your build, but never outward, up or down.",
      core: "Brace your stomach lightly and don't arch your back to help. Breathe out as you press, then come back slowly breathing in, without letting the weight slam.",
    },
    top: "Pressed all the way out",
    rising: "Pressing out",
    bottom: "At the stretch",
    lowering: "Coming back",
    notice: [
      `${NOT_EXACT} shoulder width and arm length differ, so set the seat height every time you use the machine.`,
      "Come back as far as your shoulders stay comfortable and your shoulder blades stay on the pad. That's the right range for you for now.",
      STOP_SHOULDER_ELBOW_WRIST,
    ],
  },
  incline: {
    cues: {
      feet: "Plant your feet flat on the floor so your body stays still while you lift.",
      back: "Head, upper back and bottom on the pad. Squeeze your shoulder blades together and lift your chest slightly, and hold that for the whole set. A natural gap at the middle and lower back is fine.",
      elbow: "Let your elbows move away from your body. At the bottom, the dumbbells are beside your chest around nipple level, nearly level with your chest, as far as your shoulders stay comfortable.",
      dumbbell: "Turn your palms slightly toward you, wrists straight. Press up in a straight line angled over your upper chest. The dumbbells don't need to touch.",
      core: "Brace your stomach lightly. Don't arch your lower back to help press.",
    },
    top: "Pressed all the way up",
    rising: "Pressing up",
    bottom: "Lowered all the way",
    notice: [
      `${NOT_EXACT} elbow angle and how far you lower can differ. You don't have to match the model exactly.`,
      "Lower as far as your shoulders stay comfortable and your shoulder blades stay on the pad. That's the right range for you for now.",
      STOP_SHOULDER_ELBOW_WRIST,
    ],
  },
  hammer: {
    cues: {
      feet: "Stand with feet about hip-width apart, weight on your whole foot, without rocking to help lift.",
      back: "Stand tall, shoulders down and not rolled forward. Don't lean back as you lift.",
      elbow: "Elbows at your sides as the pivot; they can move forward only slightly near the top. Lower until your arms are almost straight but not locked.",
      dumbbell: "Palms facing your body the whole way, without turning your hands, wrists straight. Lift until the dumbbells come close to your shoulders; they don't need to touch.",
      core: "Brace your stomach lightly to keep your body still. If you have to swing your body to help, the weight may be too heavy.",
    },
    top: "Lifted all the way up",
    bottom: "Lowered all the way",
    rising: "Lifting",
    notice: [
      `${NOT_EXACT} elbows bend by different amounts. You don't have to match the model exactly.`,
      "Lift as far as your elbows stay at your sides and your wrists stay straight. That's the right range for you for now.",
      "If you feel a sharp or unusual pain in your elbow, wrist or shoulder, stop right away and talk to a professional.",
    ],
  },
  squat: {
    cues: {
      feet: "Feet about shoulder-width apart, toes turned out a little, heels down the whole time. Knees follow your toes; don't let them cave in.",
      back: "Back straight, chest open, looking ahead. Lean forward slightly as you sit down, without letting your back round.",
      elbow: "Let your arms hang loose like hooks holding the dumbbells. No need to bend your elbows or lift with them.",
      dumbbell: "Palms facing your body. The dumbbells move straight up and down beside your legs. Go down until your hips are a little below your knees, or as far as your back stays straight and your heels stay down.",
      core: "Brace your stomach before going down, then push the floor away with your whole foot until you're standing tall.",
    },
    top: "Standing tall",
    bottom: "Sitting all the way down",
    rising: "Standing up",
    notice: [
      `${NOT_EXACT} foot width and depth can differ. You don't have to match the model exactly.`,
      "Go down as far as your back stays straight and your heels stay down. That's the right range for you for now.",
      "If you feel a sharp or unusual pain in your knees, hips or back, stop right away and talk to a professional.",
    ],
  },
  shrug: {
    cues: {
      feet: "Stand with feet about hip-width apart, knees slightly bent, weight on your whole foot.",
      back: "Push your bottom back and lean forward slightly with a straight back. Hold this position the whole set.",
      elbow: "Let your arms hang straight down to the floor. Don't bend your elbows to help pull; only your shoulders move.",
      dumbbell: "Hold the dumbbells at your sides, palms facing in. Lift your shoulders straight up toward your ears, squeeze your shoulder blades together a little, and hold for a moment. Don't roll your shoulders in circles.",
      core: "Brace your stomach lightly to keep your body still. Breathe out as you lift, and lower slowly as you breathe in.",
    },
    top: "Shoulders all the way up",
    bottom: "Shoulders all the way down",
    rising: "Lifting the shoulders",
    notice: [
      `${NOT_EXACT} how far you can lift your shoulders can differ. You don't have to match the model exactly.`,
      "Lift as far as your neck stays comfortable, without dropping your head or pushing your chin out. That's the right range for you for now.",
      "If you feel a sharp or unusual pain in your neck, shoulders or back, stop right away and talk to a professional.",
    ],
  },
  raise: {
    cues: {
      feet: "Stand with feet about hip-width apart, knees slightly bent, weight on your whole foot, without rocking to help lift.",
      back: "Push your bottom back and lean forward slightly with a straight back, shoulders down and not shrugged up to your ears. Hold this position the whole set.",
      elbow: "Bend your elbows slightly and keep that angle, elbows leading your hands. Lift out to the sides and slightly forward until your elbows are about shoulder height.",
      dumbbell: "Hands stay slightly lower than your elbows the whole way, palms facing the floor at the top, wrists straight.",
      core: "Brace your stomach lightly to keep your body still in the forward lean. If you have to swing your body to help, the weight may be too heavy.",
    },
    top: "Lifted all the way up",
    bottom: "Lowered all the way",
    rising: "Lifting",
    notice: [
      `${NOT_EXACT} how high you can lift comfortably can differ. You don't have to match the model exactly.`,
      "Lift as far as your shoulders don't shrug up, your elbows still lead your hands, and your body stays still. That's the right range for you for now.",
      STOP_SHOULDER_ELBOW_WRIST,
    ],
  },
  shoulder: {
    cues: {
      feet: "Plant your feet flat on the floor. Don't push yourself up off the seat to help lift.",
      back: "Upper back and bottom against the pad, looking straight ahead. A natural gap at the lower back is fine, but don't arch it more as you press.",
      elbow: "On the way down, bring your elbows slightly forward rather than straight out to the sides, forearms upright over your elbows. Lower the dumbbells above the front of your shoulders, as far as your shoulders stay comfortable.",
      dumbbell: "Turn your palms slightly toward you, wrists straight. Press straight up until your arms are almost straight overhead. The dumbbells don't need to touch.",
      core: "Brace your stomach firmly and keep your ribs from flaring, which helps stop your lower back arching.",
    },
    top: "Pressed all the way up",
    rising: "Pressing up",
    bottom: "Lowered all the way",
    notice: [
      `${NOT_EXACT} elbow width and how far you lower can differ. You don't have to match the model exactly.`,
      "Lower as far as your shoulders stay comfortable, and press up without arching your back. That's the right range for you for now.",
      "If you feel a sharp or unusual pain in your shoulder, elbow or neck, stop right away and talk to a professional.",
    ],
  },
};

/** The viewer copy for an exercise in the given language. */
export const pressContent = (exercise: PressExercise, locale: Locale): PressContent =>
  (locale === "en" ? PRESS_CONTENT_EN : PRESS_CONTENT)[exercise];
