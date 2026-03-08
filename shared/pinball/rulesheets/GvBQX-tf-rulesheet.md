---
title: "Houdini: Master of Mystery"
source: "https://tiltforums.com/t/houdini-rulesheet/3934"
provider: "tf"
source_updated_at: "2024-10-24T17:30:25.607Z"
---
<small class="rulesheet-attribution">Source: Tilt Forums community rulesheet | Original thread: <a href="https://tiltforums.com/t/houdini-rulesheet/3934">link</a> | Updated: 2024-10-24T17:30:25.607Z | License/source terms remain with Tilt Forums and the original authors. | Reformatted for readability and mobile use.</small>

<div class="pinball-rulesheet remote-rulesheet tiltforums-rulesheet">
<p><strong>Houdini Rules</strong><br>
Current Version: 18.12.12</p>
<p>Playfield Design, Mechanics: Joe Balcer<br>
Engineering: Jim Thornton<br>
Rules, Programming, Animation: Josh Kugler<br>
Artwork, Animations: Jeff Busch<br>
Music, Sound: Matt Kern<br>
Sculptures: Matt Riesterer (Back Alley)<br>
Animation: Ish Raneses</p>
<p>Rules edited and compiled from the following sources: American Pinball, This Week in Pinball, Josh Kugler, Straight Down The Middle: a pinball show YouTube channel, konjurer, et al.</p>
<p>Original Wiki Rulesheet hosted on <a href="//tiltforums.com/t/houdini-rulesheet/3934">Tilt Forums</a></p>
<p>Conventions:<br>
<code>Monotype</code> is used for feature adjustment values. Unless specified, these are defaults.</p>
<hr>
<p><strong>THE GOAL</strong></p>
<p>The goal of Houdini is to become a Master Magician, which is the final wizard mode. This is done by spelling H-O-U-D-I-N-I; each of the 7 letters correspond to 7 major areas of the game: Stage modes, Movie modes, the Magic Shop, Jail Escape hurry-ups, Secret Mission combos, Trunk Multiball, and Seance Multiball.</p>
<p>Each of these areas is represented by a different color, and progress in each can be seen in the status dashboard by holding both flippers or collecting a Houdini letter. The movies, escapes, and missions are also tracked by the chain link inserts near the flippers.</p>
<p>Getting to the Master Magician Mode can be made less difficult in the settings (see “Suggested Home Settings” for more information).</p>
<p><strong>OVERVIEW</strong></p>
<p><em>Skill Shot</em><br>
3 random rotating awards</p>
<p><em>10 Stage Modes</em></p>
<ul>
<li>Vanishing Elephant</li>
<li>Chinese Water Torture</li>
<li>Indian Needle Trick</li>
<li>Walk through Walls</li>
<li>Handcuff King</li>
<li>Milkcan Escape</li>
<li>Metamorphosis</li>
<li>Bullet Catch (multiball using the upper catapult)</li>
<li>Straight Jacket Escape (Multiball with reverse/inverted flippers)</li>
<li>King of Cards (video mode)</li>
</ul>
<p><em>Mini Wizard Modes</em></p>
<ul>
<li>Movie Binge - complete all 5 Movie Modes</li>
<li>Great Jail Escape - complete all 5 Jail Escape Hurry-Up Modes</li>
<li>Ultimate Secret Mission - complete all Secret Mission Combos</li>
</ul>
<p><em>Master Magician Wizard Mode</em><br>
You must collect all the Houdini letters:</p>
<ul>
<li>Complete <code>10</code> Stage Modes</li>
<li>Complete <code>5</code> Movie Modes</li>
<li>Collect <code>8</code> items from the Magic Shop</li>
<li>Complete <code>5</code> Jail Escape Hurry-Up Modes</li>
<li>Complete <code>5</code> Secret Mission Combos</li>
<li>Collect <code>3</code> jackpots during Trunk Multiball</li>
<li>Collect <code>2</code> jackpots during Seance Multiball</li>
</ul>
<p><em>Outlane Modes</em><br>
There are 2 modes that are set up at the outlanes that can revive your ball.</p>
<ul>
<li>Return from Beyond</li>
<li>Escape Death</li>
</ul>
<hr>
<p><strong>SKILL SHOT</strong></p>
<p><strong>Regular:</strong> Plunge to hit one of three roving ESC targets, each with an award. Possible awards include:</p>
<ul>
<li>Points (values increase with each skill shot made)</li>
<li>Light Outlane Mode (only one is lit; alternates with flippers)</li>
<li>Escape Letter</li>
<li>Film Letter</li>
<li>Seance Letter</li>
<li>Hold Multiplier</li>
<li>Magician’s Choice</li>
<li>Milkcan Multiplier (immediately starts 2X Milkcan Multiplier scoring)</li>
<li>5X Multiplier</li>
<li>Open Magic Shop</li>
<li>Open Movie</li>
<li>Award Lock</li>
</ul>
<p><strong>Super:</strong> Soft plunge to the left Magic target to collect all 3 listed awards.</p>
<p><strong>STAGE MODES</strong></p>
<p>Color Code: Red</p>
<p>Flipping the respective flippers scrolls left and right through the 10 Stage illusions, and a progress map, shown on the API Theater marquee. They are <em>not</em> awarded randomly. The currently displayed illusion (the progress map represents magician’s choice) is locked-in upon opening the stage curtain in one of three ways:</p>
<ul>
<li>Bash the stage curtain <code>4</code> times.</li>
<li>Bash the stage curtain through a clean Stage Alley shot, not hitting a single bumper.</li>
<li>Shoot the Key Lane and hit the back red Key Target without hitting a single bumper.</li>
</ul>
<p>When the curtain is open, shooting the Stage starts the mode. Shooting the Stage Alley through to the Stage without hitting a bumper begins the stage mode at 2X value; the top-right corner of the display will read “2X Stage Scoring” in red.</p>
<p>If the stage is locked-in to magician’s choice, you get to select which illusion to start from those not yet played. In addition to opening the stage curtain on the progress map, magician’s choice is available as an award from the skill shot and magic shop. These awards will override the selected illusion when the stage curtain is already open. Magician’s choice is an important tactical advantage, as availability of multiball, active playfield or mode scoring multipliers, and other conditions can be considered.</p>
<p>Basic stage modes run on a <code>45</code> second timer. At 10 seconds, the orbits will light to “add time”.</p>
<p>Once per Stage mode (with the exception of <em>King of Cards</em>, <em>Bullet Catch</em>, and <em>Indian Needle Trick</em>), the Magic standup targets turn red. Hitting one of them awards a free mode shot. See “Magic Targets” for more information.</p>
<p>Film modes cannot be started during Stage modes.</p>
<p><em>Vanishing Elephant</em> — 3 ramp shots move elephant into the crate, then stage to show crate empty.</p>
<ul>
<li>Ramp 3 times</li>
<li>Stage</li>
</ul>
<p><em>Chinese Water Torture</em> — Key Lane to lower into tank, either orbit to close curtain, stage to open curtain and set Houdini free. There is now recognition for the fastest escape from the tank!</p>
<ul>
<li>Key Lane</li>
<li>Either Orbit</li>
<li>Stage</li>
</ul>
<p><em>Indian Needle Trick</em> — All switches score X, Magic and Key standup targets increase switch value. Houdini pulls needles out of his mouth as shots are made.</p>
<ul>
<li>All switches</li>
<li>Magic/Key targets to increase switch value</li>
</ul>
<p><em>Walk through Walls</em> — To move Houdini through the wall, shoot one of the right shots, then one of the center shots, then one of the left shots.</p>
<ul>
<li>Right Shot (Inner Loop, Right Orbit, or Scoop)</li>
<li>Middle Shot (Stage, or Ramp)</li>
<li>Left Shot (Left Orbit, Stage Alley, or Key Lane)</li>
</ul>
<p><em>Handcuff King</em> — Shoot the pops and every <code>3</code> hits results in a handcuff or chain being thrown out. Shed all <code>6</code> handcuffs to free Houdini. There is now recognition for the fastest escape from the cuffs!</p>
<ul>
<li>Hit <code>3</code> pops to shed a handcuff</li>
<li>Shed <code>6</code> handcuffs</li>
</ul>
<p><em>Milkcan Escape</em> — Shoot the lower left loop 3 times to lower him into the milkcan, roll out the screen, and then show him free. This can be the most lucrative of the stage modes.</p>
<ul>
<li>Milkcan Loop 3 times</li>
</ul>
<p><em>Metamorphosis</em> — Shoot trunk to lower Houdini into the trunk, then orbit to close curtain, then stage or trunk to open curtain to reveal Houdini free, and Bess then in the trunk.</p>
<ul>
<li>Trunk</li>
<li>Orbit</li>
<li>Stage or Trunk</li>
</ul>
<p><em>King of Cards</em> — A video mode where you are throwing cards (known as scaling) through moving hoops. The longer you hold the flipper in before throwing, the higher it will go, so you need to time it both for when you start and release your press. As you make shots, the hoops move faster. Making 3 of the smaller hoop will then light the smaller hoop for extra ball. It is possible to make both hoops with a single throw, which will double their value.</p>
<p>The mode starts with <code>5</code> cards to throw from each hand and will time out after <code>45</code> seconds.</p>
<p><em>Straight Jacket Multiball</em> — An instant 3 ball multiball, with jackpots at the Orbits, Stage Alley, Key Lane, and Ramp. The last shot made is worth a super jackpot, after which all jackpots are relit.</p>
<p>At the start, you get to choose how the mode plays with your flippers (holding the left or right).</p>
<p>“Reversed Flippers”: The left flipper button controls the right flipper, and vice versa. It’s Springfield Mystery Spot (<em>The Simpsons Pinball Party</em>) all over again. Jackpots are at normal value.</p>
<p>Hint: Cross your arms while flipping. Your brain will work as intended and you should be fine.</p>
<p>“Reversed and Inverted Flippers”: Same as above, except that the flippers stay in the “up” position until you press a flipper button, at which point they drop. Jackpots are 3X.</p>
<p>Hint: Good to practice. This can be very valuable.</p>
<p>Beware: the game will <em>penalize</em> you for hitting both flippers at the same time. You get warned for “chimping”;<br>
and a cymbal-clashing monkey appears on the display. Keep double flipping and the jackpot value decreases.</p>
<p><em>Bullet Catch</em> — A 2 ball multiball, in three phases.</p>
<ul>
<li>Shoot the Inner Loop to load the gun (ball lock). This is on the basic stage mode timer.</li>
<li>Shoot the roving hurry-up shot to fire, locking in the location and value. It starts at the Milkcan Loop and rotates right. A drain here ends the mode, but play continues with the release of the locked ball.</li>
<li>The locked ball is released for a 2 ball multiball. Shoot extra jackpots at the stopped rover and Inner Loop.</li>
</ul>
<p>Note the rover is a one-switch shot. Importantly, this means “Orbits” count from either direction.</p>
<p>Play all 10 Stage modes, and you’ll get:</p>
<p><em>Encore Bonus</em></p>
<p>The crowd chants Houdini’s name, and the Stage opens if it was not already. Shoot the Stage to earn a bonus consisting of:</p>
<ul>
<li>The total points earned from all Stage modes.</li>
<li>An extra 10% bonus for each mode completed.</li>
</ul>
<p>Encore Bonus can only be doubled by the 2X Stage Alley shot; Milkcan Multipliers won’t count. At any rate, when collected the Stage Modes reset, and you can play them all again.</p>
<p><strong>MAGIC TARGETS</strong></p>
<p>The Magic Standup Targets help you in different ways depending on the current state of the game.  Hitting a magic target can add escape letters, séance letters, or film letters.  Hitting a target can also advance you a step during a Stage Mode or Movie Mode.  The magic targets also engage the magnets.</p>
<p><strong>MOVIE MODES</strong></p>
<p>Color Code: Blue</p>
<p>There are 5 modes based on Houdini’s movies. These modes are presented in black and white with an old film look and have a piano accompaniment. Failing to complete results in the film “burning”. One is a type of add-a-ball multiball. Complete all 5 for a Houdini letter. Completing all 5 will also start the Mini-Magician Mode called Movie Binge.  You don’t have to complete each movie mode, but how well you did at each mode will impact your scoring potential in Movie Binge. By default the order is <code>random</code>, but the listed order is used when set to <code>fixed</code>.</p>
<p>Basic movie modes run on a <code>45</code> second timer. At 10 seconds, the orbits will light to “add time”.</p>
<p><em>Haldane of the Secret Service</em> (<code>60</code> spins on the spinner) — Escape the waterwheel. Each shot makes it spin faster until it breaks free.</p>
<p><em>Grim Game</em> (Orbit, ramp, orbit) — Move Houdini from plane to plane to rescue the woman.</p>
<p><em>Man From Beyond</em> — This is an add-a-ball kind of mode. First bash the stage to free Houdini from the Ice (where he was frozen for 100 years), which will then put a second ball in play. Next, shoot orbits X times to free him from his restraints in the insane asylum, where another ball is put into play and the lights turn off except for three shots and a moving ‘spotlight’ running through inserts. Only one of the three lit shots will pay off. You can figure out which by sneaking a peek at the display and spotting Houdini when the spotlight is on him. Shooting the correct shot scores a jackpot, and then Houdini will randomly move between the three shots.</p>
<p><em>Terror Island</em> (Scoop, ramp, scoop, ramp) — Free the woman from the safe that was thrown in the ocean, then go back for the treasure.</p>
<p><em>Master of Mystery</em> (Left orbit, right orbit, left orbit, right orbit) — Featuring Q The Automaton, the first ever movie robot. Stop him from getting the woman or getting to the weapon. You only have X seconds to complete the next shot in the sequence, and making it resets the clock (but less time that previous shot).</p>
<p>Note: For most of the stage and movie modes, you can also hit one of the two Magic Standup Targets, which are located on either side of the lower playfield to advance a step through the mode. When not in a mode, these targets will assist you in other ways, based on current state, typically adding ESCAPE, SEANCE or FILM letters. They will also trigger the magnets under the hands which will then twirl and throw the ball. There is an optional ball saver (controlled via settings), when the magnets are triggered via the targets (and when not in seance mulitball).</p>
<p><strong>JAIL ESCAPE HURRY-UPS</strong></p>
<p>Color Code: Green</p>
<p>Spell E-S-C-A-P-E via stand-up targets and shoot the Jail hole to begin a Jail Escape Hurry Up. Complete <code>5</code> escapes to earn a Houdini letter, and cue the Great Jail Escape mini-wizard mode.</p>
<p>E-S-C stand-up targets are shootable but the A-P-E letters are not.  Use the pop bumpers and indirect shots to hit the A-P-E stand-ups. Light the Escape Death outlane mode by completing ‘2’ escapes, and light extra ball by completing <code>3</code>.  By default, jails are selected in a <code>random</code> order. The listed order is used when order is set to <code>easiest to hardest</code>.</p>
<p>The 5 jails are:</p>
<ul>
<li>Paris - Trunk for 50,000</li>
<li>London - Key Lane for 40,000</li>
<li>New York - Ramp for 40,000</li>
<li>Sydney - Spinner for 50,000</li>
<li>Chicago - Milkcan Loop for 75,000</li>
</ul>
<p>Rule designer Josh Kugler stated that “random is default since always seeing same one first would annoy most owners. However, random just means how it is set at the beginning, so if you get New York first and don’t make it, you will see the other four before it gives you NY again.”</p>
<p>Kugler went on to say that “the <strong><em>easy</em></strong> difficulty setting, means you only need the ‘first part’ of a shot versus the complete shot (normal/hard).”</p>
<p>A beginner set the Escape modes to easy to be a little more forgiving.  “The Milkcan shot, you only need to hit the magic target or near it - you don’t have to make the loop.”  On easy mode you can just sneak it up the ramp and it doesn’t have to make it all the way around.  With the Key Target - you just need to hit key lane.  Inner loop?  Just first switch and you don’t have to make it around the bend.  On easy you can hit the spinner from either direction and not just the right orbit.</p>
<p>Complete all hurry-ups, then complete ESCAPE again and land a ball in the Jail hole to start…</p>
<p><em>The Great Jail Escape</em></p>
<p>All 5 hurry-ups restart. The hurry-up value is the total points earned in all previous hurry-ups; each scores the hurry-up value. Complete all 5 shots to end the mode successfully. If the hurry-up value runs out, the mode ends.</p>
<p>[more information needed]</p>
<p><strong>SECRET MISSION COMBOS</strong></p>
<p>Color Code: Pink</p>
<p>Houdini was rumored to be a spy for the US government - hence the secret missions! Each secret mission is a combo. There are 5 different missions, and each combo gets progressively harder to complete. The secret missions are considered to be the hardest objective in the game to complete.</p>
<p>Secret Missions start at the scoop. Only one secret mission is active at a time. Complete it and you can then start the next. The next shot in the sequence is identified with a flashing purple arrow. If the sequence is broken, it will go back to the first shot of the sequence. Complete <code>3</code> missions to light extra ball and <code>5</code> missions for a Houdini letter. Completing all the missions lights the scoop for a mini-wizard mode.</p>
<ul>
<li>Combo Mission 1:  Ramp, then Scoop for 50,000</li>
<li>Combo Mission 2:  Right Orbit, then Scoop for 75,000</li>
<li>Combo Mission 3:  Ramp, Right Orbit, then Scoop for 125,000</li>
<li>Combo Mission 4:  Ramp, Right Orbit, then Inner Loop for 175,000</li>
<li>Combo Mission 5:  Milkcan Loop, Ramp, Right Orbit, then Scoop for 250,000</li>
</ul>
<p><strong>OUTLANE MODES</strong></p>
<p>Complete the task to continue your ball; fail and the ball ends.</p>
<p><em>Return From Beyond</em><br>
You get 30 flips to spell SEANCE (via mini stand-up targets). Earned by scoring <code>2</code> jackpots during Seance Multiball.</p>
<p><em>Escape Death</em><br>
You get 30 seconds to spell ESCAPE (via stand-up targets). Escape Death is the harder of the two. Earned by completing <code>2</code> Jail Escape hurry-ups.</p>
<p>You can also light the outlane drain modes at the Magic Shop. If earned there it will bounce from side to side with each flip. If earned via Seance or Escapes, it will not move. If you have earned one plus magic shop version, then both outlines are lit. You can only earn each once per game.</p>
<p><strong>MAGIC SHOP “MYSTERY AWARD”</strong></p>
<p>Color Code: Yellow</p>
<p>Spinning the spinner enough times lights the Magic Shop at the Jail hole for a mystery award. By default the order is <code>random</code>, but the listed order is used when set to <code>fixed</code>.</p>
<p><em>Magic Shop Awards:</em></p>
<ul>
<li>Increase Bonus Multiplier</li>
<li>Advance Milkcan Multiplier</li>
<li>20 Seconds of Ball Save</li>
<li>Magical Points (varies from 5,000 to 10,000)</li>
<li>Hold Bonus Multiplier</li>
<li>Award Trunk Lock</li>
<li>Light Extra Ball</li>
<li>Light Return from Beyond or Escape Death (only one is lit; alternates with flippers)</li>
</ul>
<p>Collecting <code>8</code> items from the Magic Shop yields a HOUDINI letter toward the Master Magician Mode.</p>
<p>Keep an eye out for the Easter Egg hat pulls, which poke fun at some of American Pinball’s friends and competitors.</p>
<p><strong>STACKING</strong></p>
<p>Stage and Film modes can run during multiballs, but only one can be started and neither Stage nor Film modes can be stacked with each other. A mode must be started <em>before</em> multiball to stack it. In single ball play, Jail Escape hurry-ups, Secret Missions, and the Magic Shop can be qualified and played, but not during multiball.</p>
<p>The best stack is Trunk and Seance Multiball and a third multiball–either <em>Straight Jacket Escape</em> or <em>Bullet Catch</em> Stage modes, or <em>The Man From Beyond</em> Film mode. Milkcan Multipliers can be started at any time.</p>
<p><strong>MULTIBALLS</strong></p>
<p><em>Trunk Multiball</em></p>
<p>Color Code: Turquoise</p>
<p>By default the lock is lit at the start of the game. Stage Alley shot will light the lock on subsequent locks. Shoot the right inner loop to catapult a ball into the trunk for each locked ball. Lock 3 balls in the trunk to start the Trunk Multiball. 3 shots are lit for jackpots; complete those then shoot trunk (via inner loop) to score super jackpot and re-light jackpots. Collect <code>3</code> jackpots to earn a Houdini letter.</p>
<p><em>Seance Multiball</em> - 3 ball</p>
<p>Color Code: Teal</p>
<p>Spell S-E-A-N-C-E to light at the scoop. The magnets will engage in this multiball.  Spell seance to score jackpots, and spell in order for super jackpot (very hard). Gets harder to light each time. Collect <code>2</code> jackpots to earn a Houdini letter.</p>
<p><strong>MILKCAN PLAYFIELD MULTIPLIERS</strong></p>
<p>Color: Orange</p>
<p>The Milkcan loop (lower left loop) is a difficult shot that feeds the left inlane. Shooting the milkman loop immediately followed by the ramp will increase the playfield multiplier for X seconds. Each time this 2 shot combo is hit advances the multiple from 2X to 3X to 4X. Starting a mode via Stage Alley with a max milkcan multiplier gives 8X scoring.</p>
<p><strong>SUGGESTED HOME SETTINGS</strong><br>
If you would like a more approachable game for the family and for new to intermediate players try these settings. This configuration allows the player to open the stage by bashing the stage curtain just one time. You also get more time to complete a mode before the mode times out and the crowd “boos” at you. When the jail escape order is from “easy to hard”, it forces you to complete the cities in order.</p>
<ul>
<li>Stage Difficulty: Easy</li>
<li>Stage Mode Timer: 45 to 60 seconds</li>
<li>King of Cards: 40 to 60 seconds</li>
<li>Jail Escapes Order: Easy to Hard</li>
<li>Jail Escapes Difficulty: Easy</li>
</ul>
<p><strong>TIPS</strong><br>
You may elect to start each stage mode by shooting through the Stage Alley lane. A well-placed shot will start the stage mode at 2X.</p>
<hr>
<p><strong>VERSION RELEASE NOTES</strong></p>
<p>Bug fixes and updates not listed - <em>only new features.</em> Check out <a href="https://www.american-pinball.com/support/updates/" class="inline-onebox" rel="noopener nofollow ugc">American Pinball Code Updates</a> for release notes and download links.</p>
<p><em>18.12.12</em><br>
New — adjustment for right lock if it is having trouble releasing the ball to the scoop or if two balls<br>
are being released. The double release can occur if the machine is set very steep. This adjustment<br>
can also be used if you find that sometimes the ball does not feed to the scoop from the subway<br>
every time. If you need guidance on adjusting this, contact support.<br>
New — high score will automatically exit after 30 seconds of no activity</p>
<p><em>18.8.1</em><br>
New — added an additional main audio track (now 4 different tracks), existing tracks have been improved<br>
New — sound effect on increase jackpot<br>
New — sound effect at start of game<br>
New — sound effect on shooter lane<br>
New — Flipper escape on Magic Shop, currently only available on visits 1,2,5,8<br>
New — voice calls for NY cop for Great Escape opening<br>
New — “progress ribbon” on ‘last scores screen’ that shows what you did on each of the major objective areas.<br>
New — points per second — shown on the last scores screen, shows who is the most strategic/efficient.<br>
New — Most Efficient Player Recognition — requires a game of at least 2 minutes to qualify<br>
New — Support for Custom Message — to use, put a png formatted file, named custom_message.png with width of<br>
1360 and height of 768 on a USB key and insert into the USB extension cable as if were doing a log dump or code<br>
update. Following directions on screen, after reboot, go to settings → Standard to enable it.<br>
New — Mini-Magician mode for Secret Missions<br>
New — Master Magician Mode — a little rough still, will get cleaned up in next release<br>
New — Reset High Scores — Go to Settings → Utilities → Reset Scores<br>
New — adjust ball save time on Trunk Multiball<br>
New — adjustment for ball save time on Seance<br>
New — 10 second ball save on Return from Beyond<br>
New — 10 second ball save on Escape Death<br>
New — consecutive ramp and loop scoring now have a 1 time 500K payout on the 7 consecutive shot, normally the<br>
7th shot will go back to the start of the ladder.<br>
New — Added support for mechanical knocker — kit availability soon<br>
New — support for Euros on the pricing/credits display</p>
<p>New — support for Pounds on the pricing/credits display<br>
New — support for Kroner on the pricing/credits display<br>
New — setting to control how much the shaker is used. Setting it to ‘Low’ will remove shaker in the pops, setting it<br>
to ‘Heavy’ will enable it for catapult build up.<br>
New — Ball save in Man from Beyond when balls 2 and 3 are put into play<br>
New — Voice calls for magicians choice<br>
New — Voice calls for Movies — new voice is a more of a movie preview voice, and is the default, you can switch<br>
back to the female voice in settings or choose random, which will use both, but each ball will be just one voice.<br>
New — Voice calls for some of the newer joke hat pulls<br>
New — Voice calls for straitjacket<br>
New — Voice calls for Bullet Catch<br>
New — Insert coin animation in attract mode (show if no credits)<br>
New — Press start animation in attract mode (show if credits or in free play)<br>
New — ball save at start of Movie Binge<br>
New — Stage Mode Status screen now shows Green for a mode completed and red for a mode started by failed<br>
New — Bonus for completing all stage modes, total points earned on the modes, plus the average score multiplied<br>
by the number of modes completed. (Straitjacket: three jackpots to “complete”, Needles: 75 needles, Bullet: 1<br>
jackpot, cardking: 4 hoops).<br>
New — cop Easter egg<br>
New — Presets — under service → Settings → Presets,</p>
<ul>
<li>You can now load a set of settings change to make the game extra easy, extra hard, etc</li>
<li>Can also save your current settings and then re-load them later (e.g. hosting an event, need to change<br>
some things, easy to now go back to what you had)</li>
<li>Can also restore factory settings from preset menu</li>
<li>As a reminder factory restores, presets and code updates do not impact pricing setup, stage calibration<br>
or coil strength.</li>
</ul>
<p><em>18.5.4</em><br>
New — pops will now pause timers, except the milkcan multiplier. It will also not pause if the<br>
current stage mode is handcuff escape or needle trick or if a multiball is active</p>
<p><em>18.4.27</em><br>
New — Fastest Escapes recognition (inspired by TNA/Scott Danesi)<br>
• Handcuff Escape<br>
• Water Torture Escape</p>
<p><em>18.4.11</em><br>
New — skill shot — each target has an an award, so hitting the flashing shot when on that target gives that award. Shooting super skill awards all three items.<br>
New — Players Choice — allows the player to choose which stage act to perform. Available when the ‘status’ screen is on the marquee. That screen can be locked in via skill shot award or magic shop award.<br>
New — match sequence. **Temp music<br>
New — added a display counter for spins needed during Haldane movie mode<br>
New — 4 additional ‘bad’ hat pull items<br>
New — animations for increasing of trunk multiball jackpot<br>
New — Setting to adjust timer for Movie modes from 30 to 60 seconds (45 second is default)<br>
New — Setting to adjust timer for Stage modes that use a timer, except king of cards which has its<br>
own setting. Adjustable from 30 to 60 seconds, 45 is default<br>
New — Settings for match sequence (credit or off) — Off will not show sequence<br>
New — Settings for match sequence (percentage) — percentage of 0 will show match sequence but never award a credit<br>
New — settings for Knocker (‘Audio High Volume’, ‘Audio Low Volume’ or ‘Off’)<br>
New — lightshow for super skill shot<br>
New — lightshow for magic targets<br>
New — Score banner animated when going from shown to hidden and vice versa<br>
New — coil adjustments for left ball lock to shorten or lengthen the time the plunger is held down. If two balls are being released reduce the time if the ball is getting hit and bouncing up when releasing increase the time. If you find you are needing to increase the time more than a small amount it is possible its s mechanical issues that needs to be addressed.<br>
New — Setting to enable an autofire of the shooter lane if the ball has been sitting idle for 60<br>
seconds. Defaults to Off<br>
New — sound effect when ball traveling the wire form return from upper catapult<br>
New — Extra ball when reaching a certain level of bonus multiplier. Controllable via settings<br>
between 5 and 9 or Off, defaults to 7</p>
</div>
