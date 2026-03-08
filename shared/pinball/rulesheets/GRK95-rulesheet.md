---
title: "The Flintstones"
source: "https://pinball.org/rules/flintstones.html"
provider: "papa"
---
<small class="rulesheet-attribution">Source: PAPA / pinball.org rulesheet archive | Original page: <a href="https://pinball.org/rules/flintstones.html">link</a> | Preserve source attribution and any author/site rights notes from the original page. | Reformatted for readability and mobile use.</small>

<div class="pinball-rulesheet remote-rulesheet legacy-rulesheet">
<SPAN CLASS="bodySmall">
(4 ball game)
<br>
Compiled by: Cameron Silver
<br>
Version: 3  [12/September/1994] - Happy Birthday Adam!
<br>
First version released 21/July/1994.
</SPAN>
<p>
Most of the stuff in this rule sheet is copyright by somebody, so just
imagine a TM after every word and you should be all right.
<p>
You may do what you wish with these rules; I won't ask for money and I
won't ask for power, although I may hint that I want a White Water
machine.
<p>
<a name="Special_Thanks">Extra Special Thanks to:</a>
<p>
<ul>
<li>  Adrian Donati
<li>  Louis Koziarz
<li>  David Graham Arnold
<li>  Larry Hastings
</ul>
<p>
<a name="New_to_this_version">New to this version:</a>
<p>
<ul>
<li> Some formatting corrected. All lines are now less than 80 characters.
<li> Yabba-Dabba-Doo added to Bowl-A-Rama in the Playfield Layout.
<li> Bowling Power-Up added to Bowling.
<li> Fourth method of getting CONCRETE added to Multiball.
<li> 'Spell CONCRETE' award added to Bronto Crane.
<li> The fact that this is only a _4_ ball game added to the heading.
<li> New Section: Bugs. For software and hardware bugs.
<li> Skill Shot values added.
<li> New Section: Attract Mode Stuff.
<li> New Section: Contents.
<li> New Section: Concurrency, added to Comments.
<li> New Section: Easter Eggs.
<li> New way to start multiball. (It may be a bug tho..)
</ul>
<p>
Abbreviations:
<p>
<ul>
<li> STTNG - Star Trek the Next Generation
<li> TZ    - Twilight Zone
<li> TAF   - The Addams Family
<li> RMIT  - Royal Melbourne Institute of Technology
</ul>
<p>
Note: Anything appearing "in double quotes" is a sound sample.
<p>
<a name="Contents"><span class="bodyTitle">Contents</span></a>
<P>
<ul>
<li>    <a href="#Special_Thanks">Special Thanks</a>
<li>    <a href="#New_to_this_version">New to this version</a>
<li>    <a href="#Contents">Contents</a>
<li>    <a href="#General_Comments">General Comments</a>
<ul>
<li>        <a href="#Concurrency">Concurrency</a>
</ul>
<li>    <a href="#Playfield_Layout">Playfield Layout</a>
<li>    <a href="#Rules">Rules</a>
<ul>
<li>        <a href="#Skill_Shot">Skill Shot</a>
<li>        <a href="#Modes">Modes</a>
<ul>
<li>            <a href="#Fred's_Choice">Fred's Choice</a>
<li>            <a href="#Joe's_Diner">Joe's Diner</a>
<li>            <a href="#Bedrock_Water_Buffalo's">Bedrock Water Buffalo's</a>
<li>            <a href="#Dino_Frenzy">Dino Frenzy</a>
<li>            <a href="#Mystery_Mode">Mystery Mode</a>
</ul>
<li>        <a href="#Multiball">Multiball</a>
<li>        <a href="#Bronto_Crane">Bronto Crane</a>
<li>        <a href="#Time_Machine_Target">Time Machine Target</a>
<ul>
<li>            <a href="#Time_Machine">Time Machine</a>
<li>            <a href="#Job_Change">Job Change</a>
<li>            <a href="#Help">Help</a>
</ul>
<li>        <a href="#Bowling">Bowling</a>
</ul>
<li>    <a href="#Bonus">Bonus</a>
<li>    <a href="#Easter_Eggs">Easter Eggs</a>
<li>    <a href="#Bugs">Bugs</a>
<li>    <a href="#Attract_Mode_Stuff">Attract Mode Stuff</a>
<li>    <a href="#Buy-In">Buy-In</a>
</ul>
<P>
<a name="General_Comments"><span class="bodyTitle">General Comments</span></a>
<P>
I like the game quite a lot. The layout is terrific with only one
small problem; the bloody center lane tends to cause balls to go straight
down the middle, often brushing the BED drop targets on the way. Perhaps
an Indiana Jones type ball saver is needed (as <u>least</u> make it an
option...)
<p>
The out lanes are ok. Compared to some other recent games they are
good. I found that the game would (at times) drain balls like there was no
tomorrow, but mostly it played really well.
<p>
The sound, animation, lights, etc. (What I like to call 'the
pyrotechnics') is excellent too. Especially the (Super) Jackpots.
<p>
Everything on our game was working correctly, so this rule sheet
should be correct in that aspect.
<p>
<a name="Concurrency"><b>Concurrency</b></a>
<P>
Most features in this game can run concurrently. I have started
multiball during Dino Frenzy, and Bowl-A-Rama. Modes can run concurrently
and continue during multiball. I believe that this change is for the
better, and congratulate the design team.
<P>
<a name="Playfield_Layout"><span class="bodyTitle">Playfield Layout</span></a>
<P>
I'll start from between the flippers, and go in a clockwise direction.
<p>
<dl>
<dt> Rock Again <dd> The ball saver and shoot again light. It is a normal globe
(not a flasher) so it will probably last quite long...</dd>
<p>
<dt> Left Flipper <dd> The usual 'long' type.</dd>
<p>
<dt> Left Sling Shot <dd> A normal sling shot, but tiny.</dd>
<p>
<dt> Left Inlane <dd> Nothing new here either. It doesn't seem to light anything.</dd>
<p>
<dt> Left Outlane <dd> Has a 'Drain Shield' light that is lit with the Shell
targets. There is no kickback though, the ball is auto-plunged.</dd>
<p>
<dt> Left Shell Targets <dd> Three stand-up targets against the side of the
machine. Lighting all three will light Drain Shield on the outlanes
for a while.</dd>
<p>
<dt> Time Machine Target <dd> A single stand-up target facing the flippers. It
has three functions that occur in the following order:
<ul>
<li>   Start the Time Machine mode ......... 'Time Machine'
<li>   Light Change Job on the right orbit . 'Job Change'
<li>   Start the Search mode ............... 'Help'
</ul>
</dd>
<p>
<dt> Left Ramp <dd> Like Judge Dredd's right ramp but on the other side of the
playfield. It feeds to the bottom loop which will be explained later.</dd>
<p>
<dt> Dino/Frenzy target <dd> Can be lit for 'Dino' and/or 'Frenzy' and is used
for the Dino Frenzy mode. This target is situated on the right of the
entrance to the left ramp. There are 3 targets in total. One of these
targets is always lit to increase the value of Dino Frenzy.</dd>
<p>
<dt> BED targets <dd> Three drop targets parallel to the side of the cabinet
which makes them hard to hit with the lower flippers. Knocking them
all down adds letters to CONCRETE.</dd>
<p>
<dt> Left Orbit <dd> A fairly standard orbit that goes around the back of the
machine. If it is lit to Start Multiball, or the Bronto Crane, the
ball will be diverted to a popper. Otherwise it will continue to the
bumpers, and often to the upper flipper.</dd>
<p>
<dt> Dino/Frenzy target <dd> Can be lit for 'Dino' and/or 'Frenzy' and is used
for the Dino Frenzy mode. This target is situated just to the right
of the orbit. There are three targets in total. One of these targets
is always lit to increase the value of Dino Frenzy.</dd>
<p>
<dt> U-Turn <dd> The best name I can think of. A short lane with a small loop at
the end. The roll-over for this shot is at the entrance to the loop,
so it will be credited even if the shot didn't work. Keep in mind
that a hard shot put in here, will come out just as hard... This is
the Super Jackpot, and the 2x Playfield shot. When this is unlit, it
awards an increasing million starting at 2 Million.</dd>
<p>
<dt> Time Machine <dd> Located in the upper left corner of the playfield is a
spinning wheel. A ball put here will remain for quite a while. I did
find that balls tended to get stuck up there, but ball searches would
spin the wheel to free them. The Time Machine is fed from the popper,
and balls are returned to the left flipper.</dd>
<p>
<dt> Bowl-A-Rama <dd> Three stand-ups behind five flimsy little bowing pins.
Three lights are in the playfield that represent a strike (center
target) or a spare (a side target). This is in the same position as
the Neutral Zone in STTNG. It is lit after 'Go Bowling' (one of the
ramps) is hit. Completing the back during normal play (<u>not</u> after a
go bowling shot) adds to YABBA-DABBA-DO. Completing Y-D-D gives you
the bowling power-up as well (see Bronto Crane). There may be other
awards for subsequent completions. See the section Bowling, in Rules,
for more info regarding the Bowling Power-Up. [Note that this has to
be hit <u>really</u> hard when the machine is new, as Williams stand-up
targets need to be 'broken in'!]</dd>
<p>
<dt> Popper <dd> Behind the Bowl-A-Rama is a popper that feeds balls to either
the Time Machine, or Bronto.</dd>
<p>
<dt> Bronto <dd> A tacky green dinosaur that the ball travels in. Basically it's
a wireform ramp covers in a green skin. I found that the ball would
often get stuck inside there, hopefully this will be fixed. Balls are
fed to Bronto from the popper, and end up in the bumpers.</dd>
<p>
<dt> Center Lane <dd> A small lane to the right of Bowl-A-Rama. It feeds the DIG
roll-over lanes (but the ball can continue to the upper flipper if
the circumstances are right, and the shot is powerful enough). This
is the Jackpot and standard counter shot. The first award is Extra
Ball at 7. The second is DIG Millions, which is Super Pops. [Note:
This lane is <u>narrow</u>. A fast ball hit here would often rattle around
and dribble down the centre. Also a slow ball that dribbles out can
hit the switch twice, the machine will credit this as two hits.]</dd>
<p>
<dt> ROCK targets <dd> Four drop targets that lie to the right of the centre
lane, just below the bumpers. When complete they add letters to
CONCRETE.</dd>
<p>
<dt> DIG Roll-overs <dd> Three roll-overs above the bumpers. When completed they
increase the bonus multipliers to a max of 10x. The ball is launched
here from the plunger. [Note that the lights can be rotated left and
right by the respective flipper button.] After the bonus x is maxed,
completing DIG awards 10 million.</dd>
<p>
<dt> Bumpers <dd> The usual triangle of bumpers in the top left corner of the
game (<u>exactly</u> like STTNG). They can feed to the orbit, or out the
side to the playfield (<u>exactly</u> like STTNG).</dd>
<p>
<dt> Right Ramp <dd> (Also the 'Rescue' ramp). Used to award 1-2-3 or go bowling.
This ramp also feeds the bottom loop.</dd>
<p>
<dt> Dino/Frenzy target <dd> Can be lit for 'Dino' and/or 'Frenzy' and is used
for the Dino Frenzy mode. This target is situated to the right of the
right ramp. There are 3 targets in total. One of these targets is
always lit to increase the value of Dino Frenzy.</dd>
<p>
<dt> Right Orbit <dd> Situated to the right of the right ramp, and feeds the
roll-overs or Time Machine (when lit). This is also another Start
Multiball shot.</dd>
<p>
<dt> Upper Flipper <dd> Sits at the entrance to the right orbit (like STTNG and
TAF). Use it for shooting the BED targets, Bronto Crane and the
U-Turn lane.</dd>
<p>
<dt> Right Shell Targets <dd> Directly opposite the Left targets, when complete
they light Drain Shield on the outlanes.</dd>
<p>
<dt> Right Outlane <dd> Has a 'Drain Shield' light that is lit with the Shell
targets. There is no kickback though, the ball is auto-plunged.</dd>
<p>
<dt> Right Inlane <dd> Nothing new here either. It doesn't seem to light
anything.</dd>
<p>
<dt> Right Sling Shot <dd> A normal sling shot, but tiny.</dd>
<p>
<dt> Right Flipper <dd> The usual 'long' type.</dd>
<p>
<dt> Bottom Loop <dd> The two ramps are connected to this loop which runs above
the centre drain, very much like Hurricane. It gives the game a nice
feature in that a ramp can feed either flipper. When a ramp is lit to
Go Bowling, the ball is always fed to the right flipper. When a ramp
is lit for a 1-2-3 shot, the ball is fed to the appropriate flipper
to make the next shot. The first time the balls travels along the
loop can be a little unnerving, but you'll soon get used to it. The
machine doesn't directly tell you when it will happen, which I
believe is good. If the ball falls off the loop, it will be
re-launched.</dd>
</dl>
<P>
<a name="Rules"><span class="bodyTitle">Rules</span></a>
<p>
<a name="Skill_Shot"><b>Skill Shot</b></a>
<P>
The plunged ball will end up at the DIG roll-overs. One will be
flashing and is movable with the flippers. Light the lane the ball will
go through. Skill shot awards start at 5 million, and increase by 2
million.
<p>
<a name="Modes"><b>Modes</b></a>
<P>
There are 4 modes in this game, with a Mystery Mode for completing
them. Start a mode my completing 1-2-3 on the ramps. All three shots may
not be on the same ramp so look for the lights, and watch to see which
flipper the ball goes to. This could be a problem if there are burnt out
globes. The modes are displayed in a line on the playfield. Lit ones have
been played, the flashing one will be started next, and off ones are yet
to be played. Modes can run concurrently, and during multiball. The
bumpers change the currently flashing mode.
<p>
Shooting 1-2-3 awards 2 million, 4 million and 6 million.
<p>
Modes continue during multiball, but you cannot start new ones.
<p>
Scores for completed modes are added when the mode ends.
<p>
The modes are:
<p>
<dl>
<dt>    <a name="Fred's_Choice">Fred's Choice</a> <dd> Timer starts at 20 seconds. The orbits and centre lane
are lit. The left orbit is Shot A (20 Million), the centre lane is
Shot B (10 Million), and the right orbit is Shot C (15 Million).
When a shot is hit, it's value goes up by 3 Million. The display is
very nice during this round, and the sound is cool too. Three
different voices try and convince you which shot to hit: "A!", "No
C!", "Shoot it up the centre!", "All of the above?!". The quotes
are continuous, and are played at random, (i.e. not in the above
order.)</dd>
<p>
<dt>   <a name="Joe's_Diner">Joe's Diner</a> <dd> This is a Move Your Car mode, and it by far the coolest
one Dr. Flash has come up with! 15 Million counts down, and once the
first shot is hit, you have 20 seconds to make 2 more for the same value.
Shoot the centre lane to collect it all.
<p>
At the start of the mode: "Gimmie a burger, cola and fries."
<p>
At the first shot: "That will be $47 sir."<br>
"That's a rip off!"<br>
The guy in the car smashes the drive-through guy in the face.
<p>
At the second shot: "Are you happy now sir?"<br>
"Do I <u>look</u> happy?"<br>
The guy in the car throws a grenade through the drive through window.
<p>
At the third (and final) shot: "Where's my fries?!"<br>
A large bird flies overhead and drops a large load on the diner.<br>
This is followed by the guy in the car shouting "Yea!".
<p>
After the third shot, the mode ends.
<p>
There are many in-the-back-ground quotes too, like "I don't <u>believe</u>
this place!".
</dd>
<p>
<dt>  <a name="Bedrock_Water_Buffalo's">Bedrock Water Buffalo's</a> <dd> A 25 second mode that is the same as Bad
Impersonator in Judge Dredd. The display shows a band playing on
stage. Shoot the BED drop targets to throw something at them. After a
while, the ROCK drop targets are lit instead of BED. I have no idea
how scoring works during this mode, as no information was displayed!</dd>
<p>
<dt>  <a name="Dino_Frenzy">Dino Frenzy</a> <dd> Two ball multiball. The 'Frenzy' light at all the Dino/
Frenzy targets will be lit. Hitting any of the three targets will
award the current value, and a cute animation. One of the targets
will have the 'Dino' light on too, hitting this target will increase
the value by 1 million (this is true during the whole game). The
value starts at 10 million.</dd>
<p>
<dt>  <a name="Mystery_Mode"> Mystery Mode </a> <dd> This can only be started after the other four. You have
20 seconds to knock down the BED and ROCK drop targets for 100
million. Each targets down scores 5 million. The mode ends after 20
seconds, or when the big points are awarded, and Fred's Choice will
become the currently flashing mode.</dd>
</dl>
<p>
<A NAME="Multiball"><b>Multiball</b></a>
<P>
Invent concrete to start multiball. There are three (well, four) ways to
spot letters in CONCRETE; completing BED, completing ROCK, (for the first
multiball only) completing DIG, and getting the 'Spell CONCRETE' award
from the Bronto Crane. I found that 2 letters would often be spotted
together, but I couldn't figure out what made the difference.
<p>
Once CONCRETE is complete (there are lights in the center of the
playfield), 'Start Multiball' will be lit on the orbits. Shoot this and
and ball will be fed to the popper. [Note, often when the ball was shot
up the right orbit, the gate near the DIG lanes didn't open in time. This
resulted in the ball going to the bumpers, but multiball started anyway.]
Multiball would also start if you complete DIG while multiball is lit. That
is, if you shoot the center lane and complete DIG, it'll start multiball. This
could be a bug.
<p>
The opening animation is great. I have no idea what it is, but assume
it has something to do with the movie.
<p>
The ball will be popped into the time machine, and two other balls will
be launched into there. The jackpot starts at 40 Million and increases as
long as there is at least one ball in the time machine, [note that the
jackpot does not max at 255 million]. Collect the regular jackpot at the
centre lane, then the super jackpot at the U-Turn. Note that the ball
that scores the jackpot is fed to the upper flipper for a shot at the
super (provided it as enough speed).
<p>
The Super Jackpot lights after the regular jackpot, and the regular
jackpot relights after the super. This continues until less than two
balls remain in play. In my opinion this sucks. There should be some
skill involved in relighting the regular jackpot (maybe completing 1-2-3
or something.) Subsequent multiballs restart the jackpot at 40 million.
<p>
If multiball ends and no jackpots were scored, there is 20 seconds to
restart it.
<p>
The ball saver is on at the start of multiball, and relaunched balls go
into the time machine.
<p>
Modes continue during multiball, and you can even start the Time
Machine Target modes.
<p>
<a name="Bronto_Crane"><b>Bronto Crane</b></a>
<P>
The left orbit lights Bronto Crane, and another left orbit will cause
the ball to be diverted to the popper. [Note that the ball that lights
Bronto Crane will not be stopped at the DIG lanes, but will continue to
the upper flipper.]
<p>
The Bronto Crane is basically a random award. The ones I've seen so far
are:
<p>
<dl>
<dt>  Bedrock Derby <dd> Usually the first one to be awarded. The display shows
two people racing on Dino's. Each bumper hit increases the speed of
one of them (the one you want to win). It is a 20 (?) second mode,
and you get 30 million for winning. It is essentially a good idea,
but all you need are a couple of bumper hits and you've won. Both
Dino's go at the same speed, so once you're in front, you stay there.
It should be that the Dino that is behind gradually catches up - so
that you need to keep hitting the bumpers.</dd>
<p>
<dt>  1, 2, 3 values doubled <dd> The values for getting 1, 2 and 3 are doubled
to 4 million, 8 million and 12 million.</dd>
<p>
<dt>  Extra Ball <dd> Awards and extra ball.</dd>
<p>
<dt>  Spell CONCRETE <dd> Spots concrete and lights multiball.</dd>
<p>
<dt>  Bowling Power-Up <dd> Displays a cool animation of Fred twirling a
bowling ball on his finger. This guarantees a strike on the next
Go Bowling shot.</dd>
<p>
<dt>  Light 2x Playfield <dd> Lights the 2x Playfield light at the U-Turn lane.
When hit all playfield values are doubled for 20 seconds.</dd>
<p>
<dt>  Multiplier Maxed <dd> Maxes the Bonus Multiplier at 10x.</dd>
<p>
<dt>  Big Points <dd> Awarded 20 million.</dd>
</dl>
<p>
<a name="Time_Machine_Target"><b>Time Machine Target</b></a>
<P>
This target starts three modes.
<p>
<dl>
<dt>  <a name="Time_Machine">Time Machine</a> <dd> Starts the Time Machine for 20 seconds. Counter starts
at 10 Million, and any ball put into the time machine (either orbits)
will start the value escalating until the ball comes out. After 20
seconds, the value is awarded, and the time machine stops.</dd>
<p>
<dt> <a name="Job_Change"> Job Change </a> <dd> Lights Change Job at the right orbit. Shooting the orbit
awards 25 million. There must be something more to this.</dd>
<p>
<dt>  <a name="Help">Help</a> <dd> Starts a search mode similar to Creature's multiball. Three shots
are lit to search for the kids: Left orbit, Centre Lane, and Right
Orbit. You have 20 seconds to find the kids by shooting Search. 5
Million is awarded per search, and 15 million for finding them. Shoot
the right ramp to rescue them.</dd>
</dl>
<p>
<a name="Bowling"><b>Bowling</b></a>
<P>
One of the two ramps is always lit to Go Bowling. Shoot the ramp (the
ball will be fed to the right flipper) and the bowl-a-Rama will be lit
for about 5 seconds. You'll hear the quote "Go for the strike". If you
shoot a strike (centre target), you get 5 million. A spare (side target)
is worth 3 million. A gutter ball (miss bowl-a-Rama altogether) is worth
nothing. A total of each frame is kept. The strike is the best, as you
hear everyone yelling "Wooga Wooga Wooo...". If you have received the
Bowling Power-Up (obtained from the Bronto Crane, or completing
Yabba-Dabba-Doo), Go Bowling will be a strike (so long as you hit the
Bowl-A-Rama). The quote will change to "I can't miss with this one.".
<p>
Three strikes starts Bowl-A-Rama multiball (2 ball), where a Super
Strike (center target) is worth 20 Million, and a Super Spare (side
target) is worth 10 Million.
<p>
<A NAME="Bonus"><span class="bodyTitle">Bonus</span></a>
<P>
The bonus multiplier starts at 1x and is increased by completing the
DIG roll-overs. Each completion scores 5 million. The multiplier maxes at
10x and subsequent completions result in 10 million.
Bonus count is made up of:
<ul>
<li> 500k * Frames bowled
<li> 500k * Concrete letters
<li> Misc. which was always 1 Million.
</ul>
<P>
<a name="Easter_Eggs"><span class="bodyTitle">Easter Eggs</span></a>
<P>
A few occurrences of DOHO:
<ul>
<li> On the slab where it spells out CONCRETE
<li> On the slab where it picks the match value
<li> On the side of the stage during the Water Buffalo mode.
</ul>
<P>
<a name="Bugs"><span class="bodyTitle">Bugs</span></a>
<P>
Following is a list of software and hardware bugs found:
<ul>
<li> The message Check Switch Upper Left EOS switch. There is no upper-left
flipper!
<li> If a plunged ball doesn't make it into the roll-over lanes, the ball
saver doesn't come on.
<li> Sometimes the ball was popped into the time machine when it should
have gone into Bronto. This doesn't really effect game-play. Note
that the ball always went into the time machine when it was supposed
to.
</ul>
<P>
<a name="Attract_Mode_Stuff"><span class="bodyTitle">Attract Mode Stuff</span></a>
<P>
In attract mode, the Flintstone's theme is played, along with the
words 'bouncy ball' style on the display. The music continues while the
display shows the famous cat putting Fred out for the night scene. Very
cool.
<p><A NAME="Buy-In"><span class="bodyTitle">Buy-In</span></A>
<P>
Buying an extra ball will start the currently flashing mode.
<p>
<span class="bodyTitle">Editor's Notes</span><P>
<ul>
<li> HTML added by David Gersic <A HREF="mailto:dgersic_@_niu.edu">dgersic_@_niu.edu</A>
<li> E-mail addresses have been expunged to prevent web-bot spamming, and Web links have been updated where possible.
</ul>
</div>
