# Equus, a procedural horse locomotion system

This document is canon. If the code and this file disagree, that is a bug in one
of them, so fix it rather than working around it.

## Build log

**Phase 0 landed.** Skeleton, terrain, lighting, two camera modes, the gait
table and the instruments. The blockout stands still on purpose, because the
solvers that pose it are Phase 1. The stride clock is live and verified.

Three things were found during Phase 0 that are not in the research above,
because they only show up once numbers are running.

1. **Swing time is not constant across body sizes.** A limb in swing is a
   pendulum and a pendulum's period goes as the square root of its length, so a
   taller horse swings a leg more slowly. The invariant swing law holds within
   one animal, not across animals. Without this scaling the model fits one body
   size and drifts for every other, which shows up as the wrong duty factor and
   then the wrong gait choice. See `swingFor` in `js/gaits.js`.

2. **A gait needs a duty factor range, not only a footfall pattern.** The
   standard classification splits walking from running at duty 0.5, so a walk
   whose duty has fallen to 0.33 is mechanically a running gait wearing a walk's
   footfall order. Auto selection was happily choosing it. Penalising the duty
   range is what makes walk hand over to trot at the right speed, and it turns
   out walk duty crosses 0.5 at almost exactly the speed a real horse breaks into
   trot, which is a good sign the model is not being fudged. See `DUTY_RANGE`.

3. **Two Froude ranges per gait, not one.** The observed range each gait can be
   performed over is wide and heavily overlapping, so penalising against it let
   canter win at gallop speeds purely because canter costs less bone strain. The
   band a horse actually chooses is much narrower, and that is what the cost
   function has to use. `froude` is the limit, `preferred` is the choice.

Calibration note: stride factors are set against observed stride lengths for a
16 hand horse, 1.7 m walking through 4.5 m galloping, rather than against duty
factor, so duty falls out of the clock instead of being fitted twice. The
resulting frequency ceiling is 1.85 Hz at 16 hands. Final calibration wants the
JEB stance and swing tables, which are paywalled, so treat the current numbers
as good but not final.

**Phase 1 landed.** Footfall planning with world locked stance, and limb IK with
the tendon couplings. It walks, trots and canters with zero measured foot drift.

Four things learned, all of them the hard way.

4. **Do not lump the scapula and the humerus into one rigid link.** That was the
   first attempt and it is why nothing worked. Lumping them leaves the foreleg
   99.8 percent extended at rest, which gives it almost no reach, so every hoof
   slid. A real forelimb gets its reach from the shoulder and the elbow flexing
   together. Solve the actual bone chain, six links in front and five behind.

5. **CCD, not FABRIK, when the joint limits are tight.** FABRIK finds positions
   and then has to be projected back onto the limits, which discards the solution
   it just found. With limits this tight it settled with the whole limb rotated
   backwards, a 1.3 m error. CCD works in angle space, so a limit is a clamp on
   the very thing being solved for. Error dropped to 40 mm.

6. **A tendon coupling must be enforced inside the sweep, and its follower
   excluded from the sweep.** Applying couplings as a pass after each iteration
   was worth 760 mm of error on its own, because the segment below the carpus is
   half a metre long and rotating it after the solve throws the hoof most of a
   metre. The follower joint has no freedom of its own, so sweeping it just fights
   the tendon.

7. **Express joint limits as maximum bend with the rest direction preserved, not
   as an allowance either side of rest.** Anatomy is described as how far a joint
   flexes from straight. Guessing which arithmetic direction counts as flexion
   gets it backwards on about half the joints, which pins them at a limit and
   costs the leg its reach. Preserving the sign of the rest turn is also what
   stops a knee from inverting, so it does two jobs.

Also worth recording: the foreleg has its own reciprocal style coupling through
the lacertus fibrosus, the tendon of the biceps brachii, tying the elbow to the
carpus. That is the forelimb stay apparatus, the thing that lets a horse doze
standing up. It was in the research but not in the plan, and the solver needs it
for the same reason the hind needs the peroneus tertius.

**Phase 2 landed.** Ground reaction force per limb, the fetlock driven as a
spring, and body sink from limb compression.

8. **Do not author peak forces. Author the profile shape and normalise against
   gravity.** Over one stride the vertical impulse has to equal the weight of the
   horse times the stride period, or the animal accelerates into the sky. So the
   stance profile is authored, the relative weighting between limbs comes from the
   measured table, and the whole thing is then scaled so the stride average comes
   out at exactly one gravity. The absolute peaks are never specified.

   They land within 4 percent of the published values anyway. At gallop: 13.8
   against a measured 14.0 for the non lead fore, 13.4 against 13.6 for the lead
   fore, 13.1 against 13.6 and 11.9 against 12.3 behind, with a fore share of 52.0
   percent against a measured 51.6. Two independent routes arriving at the same
   numbers is the best evidence available that the model is not being fitted to its
   own answer, and it is why this is worth doing the hard way.

9. **The measured peak table encodes two asymmetries, and applying both at once
   double counts.** The within pair ratio, lead against non lead, belongs to the
   table. The between pair split, fore against hind, belongs to engagement. The
   first attempt multiplied one by the other and pushed the fore share to 53.6
   percent when it should have been 51.6, which made the hinds read 6.5 percent
   light. Normalise the table to a mean of one inside each pair first.

10. **The fetlock is not a joint the IK should solve.** There is no muscle below
    the carpus or the hock, only tendon, so it is a passive spring answering to
    force. Making it a driven joint, set from compression and excluded from the
    CCD sweep, is both simpler and more correct than letting the solver choose it.

    It also validates cleanly: force over the measured 130 N/kg/m stiffness gives
    39 degrees of extension at the gallop peak and 23 at the walk peak, against a
    real range of 35 to 45 at gallop. It returns to exactly its rest angle when the
    limb goes light. None of that was tuned.

11. **CCD needs an escape route, and this was the biggest quality win in the
    phase.** CCD converges to a local minimum, and seeding each frame from the
    previous pose makes a bad minimum sticky: after a gait change a hind limb
    would sit 94 mm off target and stay there indefinitely, because every frame
    started from the same stuck configuration. Nothing about more iterations helps,
    since it is already converged, just to the wrong place.

    The fix is to notice a poor result on a reachable target, throw the pose away,
    re-seed from rest and solve again, keeping whichever came out better so the
    retry can never make things worse. Stance error across all gaits went from 24
    to 94 mm down to 0.9 to 4.5 mm. Worth watching for anywhere else a solver is
    warm started from its own previous answer.

Body sink now comes from the springs rather than from a curve, so the vertical
bob changes correctly with mass, speed and stiffness instead of being animated.
Roughly 4 cm at walk and 11 cm at gallop.

Note that trot and canter currently show no suspension, because the Phase 1
stride clamp raises their duty factor above the point where a suspension exists.
That is another thing the thoracic sling fixes, not a separate bug.

**Known gap at the end of Phase 1.** The body currently drops a fixed crouch to
buy the legs their reach, capped at 12 percent of leg length. Most of a real
forelimb's reach comes from the scapula rotating on the ribcage, the thoracic
sling, which raises the pivot and lengthens the arc without lowering the body at
all. Until that lands in Phase 3, stride length is clamped to what the legs can
actually cover, so canter and gallop under stride: 2.91 m against an ideal 3.50,
and 3.43 against 4.87. That is a deliberate trade of stride for posture, since a
squatting horse reads worse than a short one. Do not tune around it, build the
sling.

## Context

Natan wants a horse he can drive around terrain with game controls, where the
legs genuinely find the ground, the gaits are real gaits rather than baked
loops, and the motion holds up to an animator's eye. The end state is a
unicorn, so we start with a white horse. Stylization is allowed but it has to
be opt-in, reached by pushing a parameter past its measured value, never baked
into the defaults.

The audience is people who care about horses and will notice when it is wrong.
That sets the design rule for the whole project: **every default sits at a
value found in the biomechanics literature, and every exaggeration is a
deliberate slider push.** When a number is known, we use the known number.

The bar is explicitly Red Dead Redemption 2 and above. Not by out-authoring
Rockstar, which is impossible, but by using an architecture with a higher
ceiling. The section below explains what their ceiling actually is.

This is a horse system, not a generalized quadruped tool.

## Why not Red Dead Redemption 2's architecture

Worth stating plainly, because RDR2 is the reference and its approach is
genuinely excellent engineering that we are still choosing not to copy.

From Tobias Kleanthous's GDC 2021 talk and the surrounding writeups, RDR2's
horse is a **clip selection system**. Roughly 6,300 unique motions. Six
separate 3D blend spaces for terrain, combining pitch, velocity and leading
foot. A system that analyses each animation and records the acceptable rates of
linear, angular and lateral velocity that animation reflects, then picks and
blends accordingly. Plus a utility AI personality layer on top driving
agitation, fatigue and injury.

It is beautiful work. But the ceiling is structural: **every pose the horse can
ever hold is a blend of poses a human authored.** That produces two hard limits.

The first is combinatorial. Coverage has to be authored for gait times slope
times surface times lead foot times turn rate times fatigue. That is why the
number is 6,300 and not 200. Every new axis of richness multiplies the
authoring bill, so richness gets rationed by budget.

The second is granularity. Their own framing, acceptable velocity ranges per
animation, means speed is quantised into bands with blends between them. Their
listed starting problems were discrete speeds, no range, no variation, stiff
turning, inconsistent transitions. They solved those impressively well, but
they solved them by adding clips and selection logic, so the artifacts get
small rather than going away.

**Our ceiling is different, not just higher.** The pose is computed from
physical state, so:

- Speed is continuous. There are no bands, so there is nothing to blend between.
- A transition can begin at any point in the stride cycle, because it is a
  change of numbers rather than a choice of clip.
- Terrain is exact per hoof from a raycast, not approximated by six blend spaces.
- A flying lead change is a permutation of a vector, not an authored animation
  per direction.
- Fatigue, injury and personality modulate parameters like duty factor, head
  carriage and limb stiffness. They do not select different clips.
- There is no combinatorial explosion at all. Slope, surface, lead and fatigue
  are inputs to one solver rather than axes of a clip matrix.

What we give up honestly: hand-authored artistry, and content breadth. Rockstar
has thousands of specific behaviours we will not have. Our bet is that a small
number of physically grounded layers, each with one real driver, generates
richness combinatorially instead of by authoring, and that this is the only way
a solo project gets past their bar on motion quality.

## The anti-jank invariant

This is the most important rule in the project, and the direct answer to
wanting rich layering without it becoming janky.

> **Every layer reads from physical state. No layer owns a timeline except the
> gait clock. Each layer has exactly one physical driver, and no two layers
> drive the same thing.**

Jank in game animation comes from two places. Discrete state switches that pop,
and layers that fight each other over the same bone. We remove the first by
having no discrete states at all, since a gait is a continuous point in phase
offset space rather than a named mode. We remove the second by assigning each
layer a single driver and forbidding overlap.

If a feature cannot be expressed as a layer with one physical driver, it does
not go in. That is the complexity brake.

## The layer stack

Fixed evaluation order. Each entry lists its single driver.

| Layer | What it does | Driven by |
|---|---|---|
| L0 Body | centre of mass trajectory, momentum, traction, turn limits | rider intent plus mass and grip |
| L1 Clock | stride phase, per limb phase offsets, duty factor | speed and the invariant swing law |
| L2 Contact | plans and world locks each hoof, raycast to terrain | L1 phase plus predicted body path |
| L3 Load | per limb ground reaction force from the support set | COM acceleration distributed over contacts |
| L4 Limb | IK to hoof, reciprocal coupling, spring compression | L2 target plus L3 force |
| L5 Spine | lateral bend, pitch, roll, thoracic sling, bascule | support polygon plus turn rate |
| L6 Neck | cervical chain, counterbalance | COM offset plus L1 phase |
| L7 Gaze | binocular cone aim, ears, rear blind spot checks | object of interest |
| L8 Passive | mane, tail, jiggle, soft tissue | linear and angular acceleration |
| L9 Breath | ribcage, nostril flare, later the sound | L1 phase at a fixed lag |
| L10 Character | weight shift at rest, arousal, fatigue | arousal and fatigue scalars |

L3 is the layer most games skip, and it is where the weight comes from. L7 and
L9 are the two I believe are unoccupied. All three are detailed below.

Note that L9 reads the same clock as L1 rather than owning a timer, which is the
anti jank invariant doing its job. Breathing cannot drift out of sync because it
has no independent clock to drift with.

## Horse anatomy the system must encode

Each of these is a specific piece of code, not a note.

**1. The reciprocal apparatus.** The peroneus tertius on the front of the tibia
and the superficial digital flexor tendon behind it mean the stifle and the hock
can only flex or extend together. A generic IK solver moves them independently
and it reads as wrong immediately. The hind limb solver couples them as one
degree of freedom.

**2. No clavicle.** The forelimb attaches by muscle only, through the thoracic
sling, and the scapula slides across the ribcage. So the shoulder gets
translation, not just rotation, and the whole forehand can elevate as a unit.
This one mechanism gives us both the rear and the bascule.

**3. The limb is two springs, and we have the stiffness number.** The forelimb
divides into a proximal spring from scapula to elbow and a distal spring from
elbow to foot. Measured stiffness between elbow and coffin joint is 101 to 156
N/kg/m with a mean of **130 N/kg/m**. The distal limb behaves as a genuinely
linear spring, validated at trot for both fore and hind. Maximal fetlock
extension is proportional to peak vertical ground reaction force.

So we never animate limb compression. We compute it, from force, through a
linear spring at the measured stiffness. Weight and impact absorption come out
for free and correct.

**4. Peak ground reaction force is measured per limb, and it is asymmetric.**
At gallop, peak vertical GRF is 14.0 N/kg for the non lead forelimb, 13.6 for
the lead forelimb, 13.6 for the non lead hindlimb and 12.3 for the lead
hindlimb. Roughly 1.4 times body weight per limb at peak.

Two things fall out. Forelimbs carry more than hinds at gallop, and non lead
limbs carry more than lead limbs in both pairs. Feed those into the spring in
L4 and the lead and non lead legs visibly compress by different amounts. That
asymmetry is measured, it is subtle, and nothing ships with it.

**5. The neck is two special joints plus a chain.** The atlanto occipital joint,
the yes joint, does pitch and essentially no lateral flexion. The atlanto axial
joint below it, the no joint, does yaw. Lateral bend distributes down C3 to C7.
A horse physically cannot turn its head laterally behind the ears, so a naive
look-at on the head bone is anatomically impossible.

**6. Turning bend is small.** On a circle at trot, the neck bends about 5.2
degrees and the thoracolumbar back about 3.75, so the neck bends roughly 1.4
times the back. Those are the defaults. The slider goes much further, but it
starts at the measured value, not at cartoon banana.

**7. Backing up is not the walk in reverse.** Rein back is two beat diagonal
with no suspension, and the mechanics invert. The forelimb protracts while
weight bearing to push the body backward, retracts while unloaded, and touches
down toe first. Playing a walk backwards is the standard mistake and it is why
most game horses look wrong in reverse.

**8. The head bob in walk is forward and back, not up and down.** It is a
craniocaudal counterbalance mass, with a lateral sway alongside.

## Gait data

Phase expressed as a fraction of one stride.

| Gait | Beats | Phase offsets | Speed | Duty factor | Suspension |
|---|---|---|---|---|---|
| Walk | 4, lateral | LH 0.0, LF 0.25, RH 0.5, RF 0.75 | 0.6 to 3.2 m/s | ~0.60 | none |
| Trot | 2, diagonal | LH+RF 0.0, RH+LF 0.5 | 1.8 to 6.7 m/s | 0.40 to 0.33 | brief, at speed |
| Canter, left lead | 3 | RH 0.0, LH+RF 0.33, LF 0.67 | 4.0 to 8.9 m/s | ~0.33 | yes |
| Gallop | 4 | RH, LH, RF, LF in sequence | 4.7 to 8.8 m/s | 0.33 to 0.29 | single |

**The invariant swing law, the most useful fact in the research.** Swing
duration barely changes with speed or gait. At a 1.5 m/s walk it measures 340
to 364 ms. At a 4.0 m/s trot it measures 346 to 347 ms, essentially identical,
while stance collapses from about 550 ms to about 224 ms.

So the clock holds swing near constant, about 0.35 s and tunable, and derives
stance from speed. Duty factor falls out rather than being authored, and gait
transitions become a consequence of the arithmetic instead of a set of magic
thresholds. This single law does a large share of the work of feeling right.

**Transition thresholds** use the Froude number, the standard dimensionless
predictor. Fr equals v squared over g times hip height, hip height about 1.5 m.
Walk to trot sits near Fr 0.5 to 1.0.

**Bone strain, useful for choosing gaits.** Peak strain rises up to 59 percent
from walk to trot, then drops 42 percent from trot to canter. Canter is
mechanically cheaper than trot. That is why a horse offered more speed prefers
to break to canter rather than trot faster, and it gives the auto gait selector
a real cost function instead of a threshold.

## Derived from the data

These are conclusions I worked out from the measured numbers rather than
statements lifted from a paper. Worth flagging as such, because they are the
places we are most likely to be doing something nobody else has, and also the
places most likely to need correcting once we can see the horse move.

**A. The published speeds are for small horses, so speed has to be
normalised.** The JEB dataset includes tolt and pace, which means Icelandic
horses. Check it against the timing: at 1.5 m/s walk with stance 550 ms and
swing 350 ms, stride period is 0.9 s, so stride length is only 1.35 m. A full
size horse walks nearer 1.7 m. So these are roughly 1.35 m animals.

The consequence matters. Duty factors and phase offsets are dimensionless and
transfer directly to any horse. Speeds and stride lengths do not. So the gait
table stores **dimensionless speed** as a Froude number, and every horse derives
its own m/s boundaries from its own hip height. Sanity check: a gait boundary at
1.8 m/s for a 0.9 m hip height is Fr 0.37, and the same Fr on a 1.4 m hip height
gives 2.25 m/s, meaning a big horse breaks to trot from a faster walk. That is
correct and observable. One table then covers draft, Arabian and unicorn with no
extra data, where games normally hardcode per creature.

**B. The first limb of each couplet takes the biggest hit.** Peak GRF is 14.0
non lead fore against 13.6 lead fore, and 13.6 non lead hind against 12.3 lead
hind. In canter and gallop the non lead limb of each pair lands first. So the
first contact of a couplet carries more load than the second, which is exactly
what the stone skip model predicts, since the first contact does the redirection
work and the second arrives already partly redirected. Implementation is to
front load compression within each couplet.

There is a second order detail here. The hind pair spread is 10.6 percent
(13.6 against 12.3) while the fore pair spread is only 2.9 percent (14.0 against
13.6). The asymmetry concentrates in the hindquarters. So **the visual tell of
which lead a horse is on lives in the hind legs, not the front.** That is
specific, subtle, and checkable.

**C. The stride frequency ceiling is computable, and it proves the fantastical
rule rather than asserting it.** Take swing fixed at 0.35 s and the duty factor
floor at 0.29. Minimum stride period is 0.35 divided by 0.71, which is 0.493 s,
so maximum stride frequency is 2.03 Hz. Real gallop stride frequency is about
2.0 to 2.2 Hz. Two independent measured numbers predict the observed ceiling.

So maximum speed equals stride length times 2.03, and to double speed you must
double stride length. Stride length is capped by limb reach plus trunk flex,
which is precisely why the rotary gallop, where trunk flex extends stride past
the limbs' anatomical reach, is the only biological route to more speed. The
fantastical axis is now derived from the data instead of chosen.

**D. Load shifts rearward with speed, which is engagement.** A standing horse
carries roughly 58 to 60 percent on the forehand because its COM sits forward.
At gallop, summed peak GRF is 27.6 fore against 25.9 hind, so 51.6 percent
against 48.4. The forehand share drops from about 59 percent to about 52 as
speed rises, meaning the hindquarters take proportionally more work at speed.
That is what dressage calls engagement, it is a continuous computable
parameter, and it produces the visual of a horse sitting down into its
acceleration.

**E. The transition rule generalises, and this is the structural insight.**
Look at the sequences. Walk is LH, LF, RH, RF, which alternates hind, fore,
hind, fore. Gallop is RH, LH, RF, LF, which groups into couplets, hind hind
then fore fore.

So walk and trot live in an **alternating** structure and canter and gallop live
in a **couplet** structure. You cannot get from one to the other by retiming,
because the grouping itself has to change, and changing the grouping requires
breaking a pair. That is the mechanical reason behind the literature's
observation that trot to canter proceeds by dissociating a diagonal.

Which means the transition system is one rule rather than a table of special
cases. **Transitions within a structural region are smooth morphs of the phase
vector. Transitions between regions must pass through a dissociation event,
gated to a legal window.** That single sentence is the whole orchestration
layer.

**F. Trot carries a strain penalty, so it is a transitional gait rather than a
cruising gait.** Peak bone strain rises 59 percent from walk to trot then falls
42 percent from trot to canter. Setting walk at 1.0 gives trot 1.59 and canter
0.92, so canter is mechanically cheaper than trot. The cost curve is therefore
**not monotonic in speed**, it has a bump at trot.

The behavioural consequence is real and observable: a horse asked for more speed
out of a trot would rather change gait than trot harder. That gives auto gait
selection a genuine cost function to minimise instead of a set of speed
thresholds, and it is where the feeling of a horse being eager to canter comes
from.

## Territory that looks unoccupied

Three findings I have not seen implemented anywhere, offered in the order I
would build them.

**1. Breathing locks to stride, with a measured phase lag.** At canter and
gallop, stride frequency and respiratory frequency synchronise 1 to 1 in fit
horses. Inspiration happens mainly during **suspension** and expiration during
**stance**, because a horse inhales when the forelimbs are unloaded and exhales
when they take weight, which minimises the muscular cost of breathing. The
stride lags the respiratory cycle by about **80 degrees at canter and 54 degrees
at gallop**.

The detail that sells it is the discontinuity. Trotters and pacers take large
breaths every few strides and the coupling is loose. Cantering and galloping
horses cannot decouple, they must breathe at stride rate. So the transition into
canter has a signature: breathing **snaps into lock**. Nostril flare, ribcage
expansion, and later the breath sound all ride one phase offset off a clock we
already have, so the cost is nearly zero and the effect is uncanny.

**2. Gaze is a geometry problem, and the usual explanation is wrong.** The ramp
retina theory, that the dorsal retina sits farther from the nodal point so the
horse focuses by tilting, **has been shown not to exist.** Horses do have poor
accommodation, undeveloped ciliary bodies, but that is not why they tilt.

The real mechanism is aiming. Binocular overlap is only 65 to 80 degrees wide
and it is oriented **down the nose**, with a blind area directly in front of the
forehead. So to bring a distant object into binocular view a horse rotates the
nose up, and to inspect something close on the ground it drops the nose. It is
pointing a narrow cone, not focusing a lens.

Implementation follows directly and is unusual: head pitch is driven by **aiming
the binocular cone, which points down the nose, at the current object of
interest.** Do that and correct looking behaviour falls out instead of being
authored. The blind spot directly behind gives the character layer a grounded
behaviour too, since a horse turns head or body to bring a rear disturbance into
a visual field it actually has.

**3. Advanced dressage movements are extreme values of one dial, not separate
moves.** Collection is measured: as collection increases, speed and stride
length decrease while fore and hind stance durations increase. Push it far
enough and suspension disappears entirely, which is piaffe. Collected trot still
classifies as a running gait, limb phase near 0.5, duty factor under 0.5, clear
aerial phase. Passage is forward and cadenced with pronounced elevation and
suspension. Piaffe is a hybrid, walking kinematics with running ground reaction
forces and COM mechanics.

So collection is a single continuous axis over duty factor and stride length,
and passage and piaffe sit at points along it. We get the upper dressage
movements as dial positions rather than as authored animations, which is the
same architectural win as the flying change.

## The style system

This is the answer to categorising the movement and then pushing it. Eight
axes, each with a real unit, a literature default, and a defined direction of
exaggeration. Style is a point in this space, so a preset is just a saved point
and there is nothing special about the presets.

| Axis | Physical meaning | Default from | Pushing it |
|---|---|---|---|
| Collection | duty factor up, stride length down, together | collection studies | toward passage, then piaffe |
| Impulsion | suspension as a fraction of stride | gait tables | float, then fantastical |
| Engagement | fore and aft load bias | derivation D | horse sits into its hocks |
| Cadence | stride frequency against the 2.03 Hz ceiling | derivation C | past the ceiling reads as scrabbling, so this one is capped hard |
| Trunk compliance | transverse toward rotary, spine flex | gallop mechanics paper | double suspension, stride past limb reach |
| Head carriage | neck base height and poll angle | cervical studies | high Arabian to low stock horse |
| Bend gain | multiplier on 5.2 degree neck, 3.75 degree back | spinal kinematics | stylised curve, at 1.0 it is real |
| Limb stiffness | the 130 N/kg/m spring | GRF validation | lower reads heavier, higher reads springy |

Presets are points, not modes. Draft is low cadence, high duty, low impulsion,
low stiffness. Arabian is high cadence, high impulsion, high head carriage.
Dressage is maximum collection and engagement. Unicorn puts cadence at its
ceiling, pushes trunk compliance toward rotary, and takes impulsion well past
real.

**Every dial's help text is a three part contract**, per
[[hover-help-on-controls]]. What it changes in the motion, the measured default
and where it comes from, and what happens when you push past it. So the panel
teaches the biomechanics while you tune, and going past a real value is always
a knowing act rather than an accident. The `rangeRow` soft range with typing
past it, from `awesome-town-city-builder/js/ui.js`, is exactly the right control
for this and gets reused as is.

## The gallop, correctly

Two findings here are the difference between our gallop and everyone else's.

**Muybridge, 1878 and 1887.** The flying gallop is a myth. Artists drew the
airborne horse with legs stretched fully fore and aft, and Muybridge's plates
killed it. The hooves leave the ground only when the legs are **folded together
beneath the body**, just before the hinds push off. Suspension is gathered, not
extended. This is a hard correctness criterion for our gallop and it is
checkable by eye.

**The horse gallops transversely, and the COM skips.** Mammals use two gallops.
The transverse gallop, epitomised by the horse, has a single suspension and the
COM redirection from downward-forward to upward-forward is initiated by a
**hindlimb** contact. The rotary gallop, epitomised by the cheetah and the
greyhound, has **two** suspensions and is initiated by a **forelimb** contact.
The horse's anterior centre of mass favours transverse for stability and
endurance. Also relevant: the ungulate trunk is stiff, whereas the carnivore
trunk is flexible enough to extend stride length past the anatomical reach of
the limbs.

The published analogy for the horse gallop is a stone skipping on water. So the
gallop COM is not a sine wave. It is ballistic flight between contacts with a
redirection impulse at hind contact. Model it that way and it is both more
correct and simpler than authoring a curve.

**This gives the fantastical mode a real axis to travel along.** Pushing the
horse past real speed should not crank stride frequency, because swing time has
a floor set by limb inertia and cranking it is exactly what makes fast
quadrupeds look like they are scrabbling. Instead, past real gallop we hold
swing at its floor and grow stride length and suspension duration, with duty
factor asymptoting toward roughly 0.15.

And the principled direction to push is **toward the rotary gallop**, because
that is what nature actually does for maximum speed: double suspension, more
trunk flex, forelimb-initiated redirection. A horse's stiff spine and forward
COM mean it cannot truly get there. So the fantastical setting becomes a horse
straining toward a gait it is not built for, which is a defensible stylisation
with a biomechanical axis rather than an arbitrary exaggeration. For a unicorn
that is exactly the right answer.

## Orchestration: transitions as phase surgery

This is the systematisation that keeps richness from becoming jank.

A gait is not a mode. **A gait is a vector of four phase offsets plus a duty
factor.** Walk, trot, canter and gallop are four points in that space. So a
transition is a path between two points, and the horse is always somewhere
legal because the contact and IK machinery below never stops running. There is
no pose blending anywhere in the system, so there are no blend artifacts
available to us as a failure mode.

The literature says transitions are not arbitrary morphs though, and this is
where the detail lives. From the dressage transition studies:

- **Trot to canter** happens by **dissociating a diagonal pair**. The observed
  mechanism is early and short placement of a forelimb just before the footfalls
  of one diagonal pair come apart. Transitions divide by whether the horse
  initiates with a fore or a hind limb.
- **Canter to trot** breaks either out of the diagonal phase, or out of the
  lead forelimb single support phase.

So each transition gets a **legal window** in the cycle plus a named
dissociation route, and the engine waits for the window rather than starting
immediately. That waiting is itself realistic, because a real horse does not
change gait mid-step either. It also means a transition is a handful of numbers
and a gate condition, not a state machine full of special cases.

**The flying lead change is the showpiece.** A lead change happens entirely
within the suspension phase, front and hind switching in the same airborne
moment, and the first foot down afterwards is the new outside hind, which
becomes the trailing hind. Measured strides containing a change have lower
velocity, shorter stride length and longer duration than normal canter strides.

In our architecture that is a permutation of the phase offset vector, gated to
the suspension window, with a small stride length and duration modulation. It
is nearly free. In a clip based system it needs an authored animation per
direction per gait per speed band. It is the cleanest demonstration available
that the architecture choice is the right one, so it is worth building early as
a proof rather than saving for polish.

## Two modes, one simulation

Lab mode is a stationary editor for reading motion. Field mode is the horse in
the world with game controls. The critical rule is that **they differ only in
camera rig and world content, and no mode flag ever reaches the locomotion
code.** If the two modes could diverge in the simulation, they would, and then
tuning in the lab would stop predicting behaviour in the field.

**Lab mode is not a treadmill.** The core invariant is that a hoof in stance is
locked in world space, so sliding the feet backwards under a stationary horse
would break exactly the thing we are protecting and reintroduce the treadmill
bug. Instead the horse genuinely travels, the camera is welded to its side at a
fixed offset, and the ground is an infinite repeating reference grid. Nothing in
the simulation knows the difference. Lab mode is a camera and a backdrop, not a
special case.

Lab mode carries the animator's instruments, since reading motion is its whole
job:

- **True side orthographic camera**, plus front and three quarter presets. Side
  ortho is what makes arcs readable.
- **Hoof path traces.** The arc each hoof describes through space, the single
  most useful diagnostic there is.
- **Onion skinning.** The previous N poses as ghosts, for reading arcs and
  spacing the way you would on a lightbox.
- **Phase scrub.** Freeze the stride and dial phase from 0 to 1 by hand to
  inspect any pose. Includes a jump straight to the suspension frame, which is
  how we check the gallop is gathered rather than extended per Muybridge.
- **Frame stepping and time scale**, including slow motion and single stride
  looping.
- **The timing chart**, which is the gait diagram drawn as stance and swing bars
  per limb, plus the GRF bars from L3.
- **A and B compare.** Two horses on the same clock with different style points,
  side by side. Because the pose is a pure function of params plus state, this
  costs almost nothing and it is the fastest way to judge a stylisation against
  the real default.
- **Transition and maneuver triggers**, so a transition can be fired repeatedly
  and watched, rather than waiting for it to happen while driving.

Field mode is game controls, terrain with real elevation, and obstacles that
force locomotion decisions. Same solver, same parameters, different camera.

## Module layout

Matching the conventions in `development/awesome-town-city-builder/`. Static,
no build step, importmap from unpkg, own serve script.

```
development/equus/
  index.html
  DESIGN.md      this document, as project canon
  css/app.css
  js/
    main.js      app shell, rAF loop, param wiring
    params.js    single tunable param object with defaults
    ui.js        control panel, reusing the rangeRow pattern
    tooltip.js   hover help layer, ported from awesome-town
    skeleton.js  anatomical skeleton spec plus blockout mesh
    rig.js       adapter, abstract targets onto a real skeleton
    gaits.js     gait table, phase space, transition routes and windows
    clock.js     stride clock, invariant swing law, duty factor
    footfall.js  step planner, raycasts, world locked stance
    load.js      L3, GRF distribution over the support set
    limb.js      IK, reciprocal coupling, two spring model
    spine.js     lateral bend, pitch and roll, thoracic sling, bascule
    neck.js      cervical chain, counterbalance
    gaze.js      L7, binocular cone aim, ears, blind spot behaviour
    body.js      momentum, traction, speed dependent turn limits, COM skip
    maneuver.js  jump, rear, strike, back kick, rein back, flying change
    style.js     the eight style axes, presets as points, Froude normalisation
    passive.js   L8, mane and tail and soft tissue
    breath.js    L9, ribcage and nostrils at the measured stride lag
    character.js L10, arousal and fatigue, idle shifts
    terrain.js   heightfield plus obstacle course
    stage.js     renderer, lighting, camera rigs
    modes.js     lab and field, camera and backdrop only, no solver flags
    lab.js       traces, onion skin, phase scrub, timing chart, A/B compare
    debug.js     gait diagram, footfall trace, support polygon, GRF bars
  assets/        Quaternius CC0 glTF
  tools/serve.js port 5183
```

Carried over from Awesome Town because they earned their place: the pose is a
pure function of params plus state, and nothing ships without hover help on its
control.

The invariant that kills the treadmill look: **a hoof in stance is locked in
world space** and the body moves relative to it, never the reverse.

## Build phases

**Phase 0, foundation.** Scaffold, stage with good lighting, heightfield
terrain, procedural blockout skeleton with correct joint count, debug overlays,
param panel shell. Download the Quaternius CC0 pack into `assets/`. Add the
`equus` entry to `.claude/launch.json` on port 5183. Write DESIGN.md.

**Phase 1, the clock and the contacts.** Gait phase space, invariant swing law,
footfall planner with world locked stance, limb IK with reciprocal coupling.
Walk, trot, canter, gallop as four points in phase space. Gait diagram overlay
so the footfall pattern is readable directly. Gallop checked against Muybridge:
gathered suspension, not extended.

**Phase 2, load and weight.** L3 GRF distribution, the two spring limb at 130
N/kg/m, per limb peak force asymmetry between lead and non lead. This is the
phase where it starts to have weight. GRF bar overlay to verify.

**Phase 3, movement and terrain.** Momentum with real acceleration limits and
speed dependent turn radius, so a galloping horse cannot pivot. The stone skip
COM model for gallop. Turning with the measured small bend. Terrain adaptation,
uneven ground planting, body pitch and roll from the support polygon. Neck
counterbalance.

**Phase 4, orchestration.** Transition routes with legal windows and named
dissociations. Auto gait selection using the bone strain cost function. The
flying lead change, early, as architectural proof.

**Phase 5, maneuvers.** Jump with true bascule and obstacle reading, so it picks
a takeoff point rather than snapping. Rein back with the inverted mechanic and
toe first landing. Rear via thoracic sling elevation. Front strike. Double
barrel back kick.

**Phase 6, the style system.** The eight axes in `style.js`, Froude normalised
speeds so one table serves any body size, presets as saved points. Full
parameter panel with the three part help contract on every dial. Collection
carried far enough to produce passage and piaffe, and trunk compliance carried
toward the rotary gallop as the headline fantastical axis.

**Phase 7, the unoccupied layers.** L7 gaze with binocular cone aiming and rear
blind spot behaviour. L9 breath locked to stride at 80 degrees for canter and 54
for gallop, including the snap into lock on the transition. L8 passive and L10
character round it out.

**Phase 8, mesh.** Attach the Quaternius white horse through the rig adapter,
and prove retargeting by pointing the same system at the deer and the wolf.

**Phase 9.** Unicorn.

## Two technical calls

**Rapier is deferred, not rejected.** The locomotion is kinematic and
procedural and a solver would fight it. Terrain queries are raycasts against
the heightfield, cheaper and far more controllable. Rapier earns its place when
we want ragdoll on a fall, knockable obstacles, or a rider. The architecture
leaves that as a clean seam. Note that L3 computing real GRF means a later
Rapier handoff has correct forces to hand over.

**Three.js is not a dead end for shipping.** Web games ship on itch.io and on
Steam through a Tauri or Electron wrapper. The real caveats are no console path,
and asset streaming plus shader compilation hitches being your own problem. And
because the motion system outputs abstract targets rather than three.js calls,
the valuable part stays portable if we ever want a different renderer.

## Verification

Served on port 5183 via the `equus` launch entry, driven through the browser
tools. Debug overlays are the primary instrument, not screenshots.

- **Phase 1 correctness.** Read the gait diagram, confirm footfall order and
  phase offsets match the table. Confirm swing duration stays flat as speed
  rises while stance shrinks. Confirm gallop suspension is gathered.
- **Foot locking.** Watch a planted hoof against the footfall trace and confirm
  zero world space drift during stance. Any sliding is the treadmill bug.
- **Phase 2 load.** GRF bars should peak near 14 N/kg at gallop, with the non
  lead forelimb reading highest and the lead hindlimb lowest. Fetlock extension
  should visibly track the bars.
- **Phase 4 orchestration.** Confirm transitions wait for their legal window
  rather than starting on input. Confirm a flying change resolves inside one
  suspension with the new outside hind landing first.
- **Animator's eye check.** Side by side against the Quaternius baked gallop
  once the mesh is attached.
- **Headless shots** through a `_shot` endpoint like Awesome Town has, so I can
  verify renders without needing you at the keyboard.

## References

Sources behind every number above, worth keeping for tuning.

**Gait and timing**
- [Gait characterisation and classification in horses](https://journals.biologists.com/jeb/article/210/2/187/17107/Gait-characterisation-and-classification-in-horses), Journal of Experimental Biology. Speed ranges, duty factors, stance and swing durations, limb phase ratios.
- [Spatio-temporal gait characteristics during transitions from trot to canter](https://pubmed.ncbi.nlm.nih.gov/23810157/) and [A study of transitions between the trot and canter in dressage horses](https://www.sciencedirect.com/science/article/abs/pii/S0737080607800712). The dissociation mechanism and transition categories.
- [Limb mechanics as a function of speed and gait](https://pubmed.ncbi.nlm.nih.gov/7166694/). The bone strain figures behind the gait cost function.

**Forces and springs**
- [Validation of vertical ground reaction forces on individual limbs](https://journals.biologists.com/jeb/article/210/11/1885/16828/Validation-of-vertical-ground-reaction-forces-on), JEB. Per limb peak GRF, the two spring decomposition, the 130 N/kg/m stiffness.
- [Ground Reaction Forces and Horses](https://madbarn.com/research-topics/ground-reaction-forces/), research index.

**Gallop mechanics**
- [Motions of the running horse and cheetah revisited: fundamental mechanics of the transverse and rotary gallop](https://royalsocietypublishing.org/doi/10.1098/rsif.2008.0328), Royal Society Interface. Transverse versus rotary, the stone skip COM model, ungulate trunk stiffness.
- [Eadweard Muybridge, The Horse in Motion](https://smarthistory.org/eadweard-muybridge-the-horse-in-motion/) and [Animal Locomotion](https://en.wikipedia.org/wiki/Animal_Locomotion). Gathered suspension, the death of the flying gallop.
- [Ungulate and carnivore gallop comparison](https://vanat.ahc.umn.edu/run/plate1.html), University of Minnesota anatomy.

**Spine, neck, maneuvers**
- [Differences in equine spinal kinematics between straight line and circle in trot](https://www.nature.com/articles/s41598-021-92272-2), Scientific Reports. Lateral bend angles.
- [Motion Coupling at the Cervical Vertebral Joints in the Horse](https://doi.org/10.3390/ani15152259). Yes joint and no joint decomposition.
- [Stay Apparatus](https://en.wikivet.net/Stay_Apparatus_-_Horse_Anatomy) and [Limbs of the horse](https://en.wikipedia.org/wiki/Limbs_of_the_horse). Reciprocal apparatus, thoracic sling, distal tendons.
- [Biomechanics of rein-back](https://www.taylorfrancis.com/chapters/mono/10.1201/b16104-13/biomechanics-rein-back-jean-marie-denoix), Denoix. The inverted backing mechanic.
- [A Biomechanical Theory on How a Horse Jumps](https://mastersonmethod.com/a-biomechanical-theory-on-how-a-horse-jumps-part-1/) and [Biomechanics of horse jumping](https://ojs.ub.uni-konstanz.de/cpa/article/download/1606/1509). Bascule, four jump phases.
- [How to Ride Flying Lead Changes](https://madbarn.com/how-to-ride-flying-lead-changes/) and [Changes of lead and flying change of lead](https://www.usdf.org/EduDocs/Training/Changes_of_lead1.pdf), USDF. Suspension timing, new outside hind landing first.

**Breath, gaze, collection, the three unoccupied areas**
- [The effects of locomotor-respiratory coupling on the pattern of breathing in horses](https://pmc.ncbi.nlm.nih.gov/articles/PMC1158850/) and [Factors influencing variation in locomotor-respiratory coupling in standardbred trotters](https://pubmed.ncbi.nlm.nih.gov/17402484/). The 1 to 1 ratio, inspiration on suspension, and the 80 and 54 degree stride lags.
- [Horse vision and an explanation for the visual behaviour originally explained by the ramp retina](https://pubmed.ncbi.nlm.nih.gov/10505953/). The paper that debunks the ramp retina and gives the real down the nose binocular geometry.
- [Perception](https://veteriankey.com/perception/) and [Vision in the Equine](https://www.extension.iastate.edu/equine/vision-equine). Binocular field width, blind spots, accommodation limits.
- [Biokinematic effects of collection on the trotting gaits in the elite dressage horse](https://pubmed.ncbi.nlm.nih.gov/8536664/) and [A Review of Biomechanical Gait Classification with Reference to Collected Trot, Passage and Piaffe](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6826507/), Clayton and Hobbs. Collection as a measured continuous axis, and where passage and piaffe sit on it.

**Architecture**
- [IK Rig: Procedural Pose Animation](https://www.gdcvault.com/play/1023279/IK-Rig-Procedural-Pose), Bereznyak, GDC 2016. The abstract target architecture.
- [An Indie Approach to Procedural Animation](https://www.wolfire.com/blog/2014/05/GDC-2014-Procedural-Animation-Video/), Rosen, GDC 2014. The few keyframes philosophy.
- [Rockstar's quest for the ultimate video game horse](https://www.gamedeveloper.com/design/rockstar-s-quest-for-the-ultimate-video-game-horse) and [Making the Believable Horses of RDR II](https://gdconf.com/news/hoof-it-gdc-and-see-how-red-dead-redemption-2s-horses-were-brought-life), Kleanthous, GDC 2021. The system we are deliberately not copying, and why.
