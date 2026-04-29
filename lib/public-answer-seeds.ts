export type PublicAnswerSeed = {
  question: string
  asker_label?: string
  player_age?: number
  answer: string
  themes: string[]
  parent_relevant: boolean
  public: boolean
  age_band?: '12-14' | '15-17' | '18-22' | '22+'
  sources?: { title: string; url: string; type?: string | null }[]
}

export const PUBLIC_ANSWER_SEEDS: PublicAnswerSeed[] = [
  {
    question: "I freeze in games but I look good in practice. What is wrong with me?",
    asker_label: "M., 16, Chicago",
    player_age: 16,
    themes: ['pressure', 'mindset', 'confidence'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `Nothing is wrong with you. Your body knows how to play. Your brain just thinks the game is danger.

In practice there is no crowd. No scoreboard. No fear of looking bad. In games your nervous system starts protecting you from embarrassment, so your body gets tight and your decisions slow down.

This week, make the game smaller. Do not try to play a perfect game. Pick one job for the first three minutes. Sprint back on defense. Touch the paint. Talk on every screen. Something simple. Something you control.

Then do the same job every game until your body trusts it.

Pressure gets lighter when you stop trying to prove yourself and start giving yourself a task.`,
  },
  {
    question: "How do I get my confidence back after a bad game?",
    asker_label: "J., 15, Dallas",
    player_age: 15,
    themes: ['confidence', 'slumps', 'mindset'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `Confidence does not come back because you tell yourself you are good. It comes back because you give your body proof.

A bad game makes your brain look for danger. It starts replaying misses so it can protect you next time. That feels like overthinking, but really your mind is asking for a plan.

Do this after your next bad game. Write down one thing you did wrong. One thing you did right. One thing you will do in the next practice. Keep it that simple.

Then go make 50 shots from the spots you actually get in games. Not random shots. Your shots.

You do not need your whole confidence back today. You need one piece of evidence. Go earn that piece.`,
  },
  {
    question: "My coach keeps benching me and I do not know why.",
    asker_label: "T., 17, Atlanta",
    player_age: 17,
    themes: ['coach', 'role', 'mindset'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `Do not guess. Guessing will make you emotional and confused.

Most players think the bench means the coach does not like them. Sometimes that is true. Most of the time the coach does not trust one specific part of your game yet.

Ask for a real answer. Not after a game. Not when you are mad. Ask for five minutes before practice. Say, "Coach, what is one thing I need to do to earn more minutes?"

Then listen. Do not defend yourself. Do not explain. Write it down and spend two weeks proving you can do that one thing.

The bench hurts. I know. But the player who gets back on the floor is usually the one who turns frustration into evidence.`,
  },
  {
    question: "Everyone on my team is getting better faster than me. I feel left behind.",
    asker_label: "A., 16, Phoenix",
    player_age: 16,
    themes: ['confidence', 'identity', 'mindset'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `Looking sideways will steal your development.

Your teammate's progress feels loud because you can see it. Your own progress feels quiet because you live inside it every day. That makes comparison feel true even when it is not useful.

Pick three things to track for 30 days. Free throws made. Turnovers. Defensive mistakes. Whatever matters for your role. Track yourself against yourself.

If you are better at the end of the month, you are moving. That is the only signal you need right now.

Some players pass you for a season. Some players pass you for good. Your job is to make sure it is not because you spent your energy watching them.`,
  },
  {
    question: "I get nervous before big games and I cannot sleep.",
    asker_label: "K., 14, Houston",
    player_age: 14,
    themes: ['pressure', 'mindset', 'body'],
    parent_relevant: true,
    public: true,
    age_band: '12-14',
    answer: `Nerves mean your body cares. They are not proof that you are weak.

The problem is when you treat nerves like an enemy. Then your brain starts fighting your own body. Now you are tired before the game even starts.

The night before, write down your first three jobs for the game. Box out. Sprint the floor. Take open shots. Then stop thinking about the whole game.

When you get in bed, breathe in for four seconds and out for six. Long exhale. Again and again. That tells your body it is safe.

You do not need to feel calm to play well. You need to know what to do when the energy shows up.`,
  },
  {
    question: "I missed two free throws at the end of the game and now I am scared to go to the line.",
    asker_label: "D., 17, Charlotte",
    player_age: 17,
    themes: ['pressure', 'confidence', 'slumps'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `The free throw line feels lonely because there is nowhere to hide.

After a miss like that, your brain remembers the pain and tries to protect you from feeling it again. That is why the line feels heavier next time.

You need a routine your body can trust. Same breath. Same dribbles. Same eyes. Same finish. Every single time. Do it in practice when nobody is watching so it is there when everybody is watching.

For the next week, shoot 25 free throws after every workout. Not at the beginning. At the end when your legs are tired. Track makes, but care more about repeating the routine.

You missed two. That is real. Now build a routine strong enough to carry you back there.`,
  },
  {
    question: "How do I stop overthinking every shot?",
    asker_label: "S., 18, Toronto",
    player_age: 18,
    themes: ['slumps', 'mindset', 'confidence'],
    parent_relevant: false,
    public: true,
    age_band: '18-22',
    answer: `Overthinking usually means you are trying to fix the shot while you are shooting it.

That is too late. Your brain cannot coach, judge, and shoot at the same time. If you give it three thoughts, your body loses rhythm.

Pick one cue. Hold your follow through. Eyes on the rim. Finish high. One cue only. Use it for a full week.

Then build your workouts around makes that feel clean. Do not chase perfect mechanics every rep. Chase repeatable rhythm.

The shot gets simpler when your mind gets quieter.`,
  },
  {
    question: "I am scared to take the big shot.",
    asker_label: "R., 16, Memphis",
    player_age: 16,
    themes: ['pressure', 'confidence', 'identity'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `You are not scared of the shot. You are scared of what missing might say about you.

That is why the moment feels so heavy. You turned one shot into a vote on your whole identity. Nobody can shoot free like that.

Before the game, decide what shots are yours. Corner three. Pull up going right. Finish at the rim. Whatever they are. If that shot shows up, you take it.

Do not decide in the moment. Decide before the moment.

Missing is part of being trusted. If you want big shots later, you have to train your body to take the right shot now.`,
  },
  {
    question: "I work hard but I am still not starting.",
    asker_label: "E., 17, Seattle",
    player_age: 17,
    themes: ['role', 'coach', 'mindset'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `Working hard matters. But working hard on the wrong thing can still leave you on the bench.

Coaches do not only reward effort. They reward trust. Can you defend the action. Can you make the simple read. Can you stay solid when tired.

Watch the player starting ahead of you. Not with jealousy. With a notebook. Write down three things the coach trusts him to do.

Then take those three things into practice for two weeks. Do not just show your strengths. Show the coach you can solve the problem he has.

Hard work gets louder when it is aimed at the right target.`,
  },
  {
    question: "I do not love basketball like I used to. Am I burned out?",
    asker_label: "L., 19, Los Angeles",
    player_age: 19,
    themes: ['burnout', 'identity', 'mindset'],
    parent_relevant: true,
    public: true,
    age_band: '18-22',
    answer: `Maybe. Or maybe you still love the game and you are tired of everything attached to it.

Pressure can make basketball feel like a job before it needs to be one. Parents. coaches. rankings. offers. expectations. At some point the game gets buried under all of that.

For one week, remove the scoreboard from your mind. Go shoot alone. Play pickup. Work on something that feels fun. No posting. No tracking. No proving.

Then ask yourself a real question. If nobody saw it and nobody praised me, would I still want to play?

If the answer is yes, the love is still there. It just needs space to breathe.`,
  },
  {
    question: "College coaches are coming to my game and I feel tight.",
    asker_label: "N., 17, St. Louis",
    player_age: 17,
    themes: ['recruiting', 'pressure', 'mindset'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `The trap is trying to play a special game because special people are watching.

That usually makes you worse. You start forcing plays. You start hunting highlights. You stop doing the things that got them interested in the first place.

Before the game, write down your normal winning plays. Defend. Run. Communicate. Take open shots. Make the next pass. Keep it boring.

Coaches are not only watching your best play. They are watching your habits. Your body language. Your response after a mistake.

Do not perform for the coaches. Show them the player your team already knows.`,
  },
  {
    question: "My coach yells at me and I shut down.",
    asker_label: "P., 15, Miami",
    player_age: 15,
    themes: ['coach', 'confidence', 'mindset'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `Getting yelled at can make your body feel attacked, even when the correction is about basketball.

When that happens, your brain stops listening for the lesson and starts protecting your pride. Then you miss the one thing that might help you.

The next time it happens, ask one question inside your head. What is the adjustment?

Not, does he hate me. Not, am I terrible. Just, what is the adjustment?

If you can hear the correction without letting it define you, you become harder to shake. That is a real skill.`,
  },
  {
    question: "I feel like basketball is my whole identity.",
    asker_label: "C., 18, New York",
    player_age: 18,
    themes: ['identity', 'mindset', 'faith'],
    parent_relevant: true,
    public: true,
    age_band: '18-22',
    answer: `Basketball can be what you love without being all you are.

If the game is your whole identity, every bad game feels like you disappeared. That is too much weight for a box score to carry.

Write down three things that are true about you without basketball. Son. friend. believer. worker. leader. Whatever is real. Keep that list where you can see it.

Then go play from that place. Not trying to earn your worth. Playing because you already have it.

The game is a gift. It is not your God.`,
  },
  {
    question: "I am short and I feel like nobody takes me seriously.",
    asker_label: "B., 14, Newark",
    player_age: 14,
    themes: ['body', 'confidence', 'role'],
    parent_relevant: true,
    public: true,
    age_band: '12-14',
    answer: `You cannot control your height today. You can control how expensive you are to guard.

Short players do not get extra respect. They have to create problems. Be faster to the spot. Be harder to pressure. Be louder on defense. Make the simple read before the defense catches up.

This week, build two weapons. A tight handle under pressure and a floater or pull up before the big can block it.

Then compete like your size is not an apology.

If they are going to doubt you, make them work hard for that opinion.`,
  },
  {
    question: "I am the sixth man and I hate it.",
    asker_label: "G., 17, Detroit",
    player_age: 17,
    themes: ['role', 'coach', 'identity'],
    parent_relevant: false,
    public: true,
    age_band: '15-17',
    answer: `Hating your role will make you miss the power inside it.

The sixth man can change the whole game. You see the flow before you enter. You know where the energy is low. You can bring pace, defense, scoring, or calm right when the team needs it.

Stop asking whether the role is fair for one week. Ask how to dominate it.

Before you check in, name the one thing the game needs from you. Energy. stops. spacing. pressure. Then give that immediately.

A role is not a ceiling. It is a job. Do the job so well the next conversation becomes obvious.`,
  },
  {
    question: "I keep turning it over when teams press me.",
    asker_label: "H., 16, Philadelphia",
    player_age: 16,
    themes: ['pressure', 'body', 'mindset'],
    parent_relevant: false,
    public: true,
    age_band: '15-17',
    answer: `Pressure speeds you up before the defender even touches you.

Most turnovers against pressure happen because your eyes drop and your first dribble gets nervous. Once that happens, the defense owns your tempo.

In practice, start every press drill with your eyes up. Say the next pass out loud before you dribble. Train your brain to see before your body moves.

Also build a simple escape. Retreat dribble. Pivot. pass fake. Nothing fancy. Just a move you trust.

The press wants panic. Your job is to make the game boring again.`,
  },
  {
    question: "How do I handle NIL and recruiting without losing my head?",
    asker_label: "V., 18, Nashville",
    player_age: 18,
    themes: ['recruiting', 'mindset', 'identity'],
    parent_relevant: true,
    public: true,
    age_band: '18-22',
    answer: `When money and attention enter the picture, the game can get noisy fast.

You need adults you trust. You need current information. You need to slow down before signing anything. Rules change. Offers change. People can make a bad deal sound urgent.

Make one folder. Put every message, offer, contact, and question in it. Then talk to your family, coach, and someone who understands the current rules before you respond.

Your job is still to develop. Do not let an opportunity turn into a distraction that steals your work.

Handle business like business. Then get back in the gym.`,
    sources: [{ title: 'NCAA NIL rules', url: 'https://www.ncaa.org/sports/2021/2/8/about-taking-action.aspx', type: 'research' }],
  },
  {
    question: "How do I stop letting one mistake turn into five mistakes?",
    asker_label: "Q., 15, Orlando",
    player_age: 15,
    themes: ['mindset', 'pressure', 'confidence'],
    parent_relevant: false,
    public: true,
    age_band: '15-17',
    answer: `The first mistake is basketball. The next four are usually emotion.

After you mess up, your brain wants to fix your reputation immediately. That is when you force a steal, rush a shot, or stop talking.

Build a reset you can do in three seconds. Clap once. Touch your chest. Say next play. Then sprint to the next job.

Practice it when you are not mad so it shows up when you are.

Great players do not avoid mistakes. They keep one mistake from becoming a run.`,
  },
  {
    question: "My parents care so much that it makes basketball stressful.",
    asker_label: "M., 16, Tampa",
    player_age: 16,
    themes: ['parent', 'pressure', 'identity'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `That is a hard spot because they probably mean well.

But love can still feel heavy when every car ride turns into a film session. You start playing for the conversation after the game instead of the game itself.

Pick a calm time and tell them one specific thing that helps. Say, "After games, I need ten minutes before we talk basketball." Or, "Ask me what I learned before you tell me what you saw."

Do not attack them. Give them a role that actually helps you.

Parents are supposed to be support. Not another scoreboard.`,
  },
  {
    question: "I am scared my body is not athletic enough.",
    asker_label: "O., 17, Denver",
    player_age: 17,
    themes: ['body', 'confidence', 'role'],
    parent_relevant: false,
    public: true,
    age_band: '15-17',
    answer: `Athleticism matters. But knowing how to play matters longer.

If you are not the fastest or highest jumper, you need advantages that do not depend on bounce. Angles. timing. strength. footwork. decisions.

Pick one physical gap and one skill gap. Maybe first step and finishing. Maybe strength and shooting off movement. Train both for 8 weeks.

Do not waste energy wishing for somebody else's body. Build the body you have into something useful.

There is more than one way to be hard to guard.`,
  },
  {
    question: "I pray but I still feel stuck in a slump.",
    asker_label: "I., 16, Birmingham",
    player_age: 16,
    themes: ['faith', 'slumps', 'identity'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `Faith does not mean you never struggle. It means the struggle does not get the final word.

A slump can make you think God is far away or that you are being punished. I do not see it like that. Sometimes the slump reveals what you were trusting too much.

Pray. Then work. Keep both. Ask God for peace, then give your body simple reps it can trust.

This week, pick one small faithful action. Show up early. Make your free throws. Encourage a teammate while you are frustrated.

Your shot can be off and your spirit can still be steady.`,
  },
  {
    question: "I keep playing good against weaker teams and disappearing against better teams.",
    asker_label: "Z., 18, Las Vegas",
    player_age: 18,
    themes: ['pressure', 'confidence', 'recruiting'],
    parent_relevant: false,
    public: true,
    age_band: '18-22',
    answer: `Better competition exposes what is not automatic yet.

Against weaker teams you have extra time. Against better teams, the window closes faster. That does not mean you cannot play. It means your decisions need to be cleaner.

Watch film from the tougher games. Find the first moment you rushed. Was it the catch. The first dribble. The pass. The shot.

Then practice that exact moment faster than comfort. Catch and decide. One dribble and decide. Pressure and decide.

The next level is not magic. It is the same game with less time to lie to yourself.`,
  },
  {
    question: "How do I get noticed if I am on a small team?",
    asker_label: "Y., 17, Boise",
    player_age: 17,
    themes: ['recruiting', 'role', 'mindset'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `Being on a small team means you have to be clearer.

You need film that shows what you actually are. Not every basket. Not a five minute mixtape of random plays. Show your role, your skill, your defense, your decisions, and your best moments against real competition.

Send coaches a short message. Who you are. Where you play. Your grades. Your role. Your link. Keep it clean.

Then keep improving so the film gets better every month.

Getting noticed is not just exposure. It is giving the right person something real to evaluate.`,
  },
  {
    question: "I get mad when my teammates make mistakes.",
    asker_label: "F., 16, Queens",
    player_age: 16,
    themes: ['mindset', 'role', 'coach'],
    parent_relevant: false,
    public: true,
    age_band: '15-17',
    answer: `That frustration might mean you care. But if it leaks out wrong, it makes the team worse.

Your teammates can feel when you are judging them. Then they get tighter. Now the mistake grows.

Leadership starts with your face. Next time somebody messes up, say one useful thing. "Next play." "I got you." "Shoot it again." Keep it simple.

Then hold yourself to the same standard when you mess up.

If your standard is high, good. Just make sure your presence helps people reach it.`,
  },
  {
    question: "I do not know what my role is anymore.",
    asker_label: "W., 18, San Diego",
    player_age: 18,
    themes: ['role', 'coach', 'identity'],
    parent_relevant: false,
    public: true,
    age_band: '18-22',
    answer: `When your role gets blurry, your game gets noisy.

You start trying to do everything because you are afraid doing one thing is not enough. That usually makes the coach trust you less.

Ask your coach for three words. "What do you need me to be for this team?" Then ask what that looks like in a game.

Once you know the job, simplify your game around it for two weeks.

Clarity gives confidence somewhere to stand.`,
  },
  {
    question: "I am tired all the time and basketball feels heavy.",
    asker_label: "U., 15, Minneapolis",
    player_age: 15,
    themes: ['burnout', 'body', 'mindset'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `Tired all the time is not a mindset problem. It might be a load problem.

Your body needs sleep, food, and recovery to carry the work. If you ignore that, your mind starts calling everything lack of motivation.

For seven days, track three things. Sleep hours. Real meals. Practice workload. Do not judge it. Just write it down.

If the numbers are bad, fix the basics before you question your love for the game.

Sometimes getting tougher starts with recovering like you actually respect your body.`,
  },
  {
    question: "I play scared after I get blocked.",
    asker_label: "X., 14, San Antonio",
    player_age: 14,
    themes: ['confidence', 'body', 'pressure'],
    parent_relevant: false,
    public: true,
    age_band: '12-14',
    answer: `Getting blocked is loud. It can make the rim feel guarded even when it is not.

But one block does not mean you stop attacking. It means you learn the next finish.

Practice three finishes this week. Strong hand. Inside hand. Floater. Do them against pads or a taller defender if you can.

Then in the game, attack with a plan instead of a hope.

The rim is still yours to challenge. Just bring more than one answer.`,
  },
  {
    question: "How do I stay locked in when I barely touch the ball?",
    asker_label: "A., 16, Sacramento",
    player_age: 16,
    themes: ['role', 'mindset', 'coach'],
    parent_relevant: false,
    public: true,
    age_band: '15-17',
    answer: `If your focus depends on touches, the defense can take your mind out of the game.

You need jobs that keep you engaged without the ball. Screen. cut. rebound. talk. defend. sprint. Those are not small things. Those are trust builders.

Pick two no touch stats for your next game. Deflections and box outs. Screen assists and rebounds. Track them yourself.

When the ball finally finds you, you will be in the game already.

Players who only wake up when they shoot are easy to replace. Players who impact the game without the ball stay useful.`,
  },
  {
    question: "I feel pressure because my family spent so much money on basketball.",
    asker_label: "S., 17, Raleigh",
    player_age: 17,
    themes: ['pressure', 'parent', 'identity'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `That pressure is real. But guilt is a bad coach.

Your family invested because they believe in you. That does not mean every game has to pay them back. If you carry the money into every possession, you will play tight.

Have one honest conversation. Tell them you appreciate the sacrifice. Then tell them the pressure you feel. Keep it calm. Keep it specific.

After that, bring the focus back to today. What is the next rep. The next practice. The next controllable thing.

Gratitude should make you steady. Not scared.`,
  },
  {
    question: "How do I know if I should transfer teams?",
    asker_label: "R., 18, Austin",
    player_age: 18,
    themes: ['coach', 'role', 'recruiting'],
    parent_relevant: true,
    public: true,
    age_band: '18-22',
    answer: `Do not transfer just because it is hard. Do not stay just because leaving feels scary.

Ask three questions. Am I being developed here. Do I know what role I am fighting for. Is the environment making me better or just smaller.

If the answer is unclear, talk to your coach first. Give the place a chance to be honest with you.

If the answer is still no after that, look for a better fit with a clear plan, not just a shinier logo.

Leaving is not weakness. But running from growth will follow you to the next team.`,
  },
  {
    question: "How do I stop chasing highlights and just play winning basketball?",
    asker_label: "D., 19, Boston",
    player_age: 19,
    themes: ['mindset', 'role', 'recruiting'],
    parent_relevant: false,
    public: true,
    age_band: '18-22',
    answer: `Highlights can get attention. Winning habits get trust.

The danger is when you start choosing the play that looks best over the play that helps the team. Coaches notice that fast.

Before each game, pick one winning habit you want on film. Early pass. Hit first. Guard the best player. Sprint to space.

Then measure the game by whether you did that habit, not whether you got a clip.

The right people can see winning. You do not have to decorate it.`,
  },
  {
    question: "I feel like I am failing my dad when I play bad.",
    asker_label: "J., 15, Columbus",
    player_age: 15,
    themes: ['parent', 'identity', 'pressure'],
    parent_relevant: true,
    public: true,
    age_band: '15-17',
    answer: `That is heavy for a kid to carry.

Your dad can care deeply and still not understand how much pressure his face puts on you. Sometimes parents think they are helping, but you start reading every look like a grade.

You need to separate love from performance. Say this when things are calm. "I need to know you are proud of me even when I play bad."

That is not soft. That is honest.

You should play hard because you love the game. Not because you are trying to earn your place at home.`,
  },
  {
    question: "I do everything right in workouts but it disappears in games.",
    asker_label: "K., 17, Oakland",
    player_age: 17,
    themes: ['pressure', 'slumps', 'mindset'],
    parent_relevant: false,
    public: true,
    age_band: '15-17',
    answer: `Workouts do not always transfer because workouts are clean and games are messy.

In a workout, you know the next rep. In a game, you have to read the defender, the help, the clock, and your own nerves.

Add mess to your workouts. Start tired. Add a defender. Add a consequence. Make decisions before shots. Do not just train the move. Train the moment.

Then judge progress by whether the game feels a little slower.

Skill is not finished until it survives chaos.`,
  },
  {
    question: "I am a parent. How do I help without making it worse?",
    asker_label: "Parent, Nashville",
    themes: ['parent', 'confidence', 'mindset'],
    parent_relevant: true,
    public: true,
    age_band: '22+',
    answer: `Start by saying less after games.

Most kids already know they played bad. The car ride is not the time for a second coach. If every drive home becomes a review, your child starts dreading the ride more than the loss.

Ask one question. "Do you want to talk about it or do you want space?" Then honor the answer.

Later, when the emotion is lower, ask what they learned and what they want to work on next.

Your job is not to remove every struggle. Your job is to stay safe enough that they tell you the truth.`,
  },
]
