import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const SEED_QUESTIONS = [
  {
    question: "I freeze up in real games but ball out in practice. What's wrong with me?",
    answer: `The freeze-up in games but not practice is almost always one thing: your brain is trying to protect you from judgment. In practice there's no scoreboard. In games there is. So it switches into threat mode — cortisol spikes, your body tightens, your instincts shut down.

I experienced this in my first EuroLeague season. Different country, different language, higher stakes. My body knew how to play. My brain didn't trust it yet.

Here's what fixed it: the night before games, I stopped trying to visualize success and started visualizing the specific moments that scared me. See yourself in the fourth quarter. See the ball in your hands. See yourself making the decision — not perfectly, just making it. Your brain stops fearing what it's already rehearsed.

The other piece: in warm-ups, find one thing you can control completely. One move. One spot on the floor. Lock into that before anything else. You're telling your nervous system: this is familiar. You've been here before. Relax.`,
    action_steps: `1. Tonight, spend 10 minutes visualizing the exact moments that scare you in games — not the outcome, the moment itself
2. In your next warm-up, find one move or one spot that feels automatic. Stay there until you feel settled
3. Before tipoff, pick one specific thing to focus on for the first two minutes only. Not the whole game. Two minutes.`,
  },
  {
    question: "My coach keeps benching me and won't tell me why. How do I handle it?",
    answer: `First — don't assume. Most players think the bench is about them. Usually it's about the team, the matchup, the system. I've been benched. It felt personal every single time. It almost never was.

Here's what I learned after years in the NBA and EuroLeague: coaches bench players for one of three reasons. You're not doing what they asked. You're doing it inconsistently. Or they're protecting you from a situation you're not ready for yet.

Go directly to your coach — not after practice when he's exhausted, but book a specific time. Sit down. Ask two questions only: "What do I need to improve to earn more minutes?" and "How will I know when I'm doing it?" Then write down exactly what he says and go do it. Nothing more, nothing less.

Don't play to prove a point. Play to solve the problem he just gave you. The players who get minutes back are the ones who execute the feedback. The ones who stay on the bench are the ones who argue with it.`,
    action_steps: `1. Request a one-on-one meeting with your coach this week — not after practice, a real sit-down
2. Ask only these two questions: "What do I need to do to earn more minutes?" and "How will I know when I'm doing it?"
3. Write down exactly what he says. That's your practice plan for the next 30 days.`,
  },
  {
    question: "I've been in a shooting slump for three weeks and nothing is working.",
    answer: `Slumps are mental before they're physical. Your shot didn't forget how to go in — your brain started compensating. You changed something small, your body felt the miss, and now you're overthinking every release.

The worst thing you can do mid-slump is change your mechanics. You're adding doubt on top of doubt. More adjustments mean more things to think about, which means slower instincts, which means more misses.

What I did during slumps: I went back to the last time I felt completely in rhythm and I wrote down everything I could remember. My pre-game routine. My sleep. What I was thinking about in warm-ups. What the ball felt like. A slump is a signal, not a sentence. Something changed — find what it was.

The mental piece: you need at least 200 makes in practice before your next game. Not attempts. Makes. Go find your spots, make 200 shots, and let your body remember what right feels like. Confidence is physical memory. Give your body the evidence it needs.`,
    action_steps: `1. Do not change your shooting mechanics this week
2. Get 200 made shots in practice before your next game — from your spots, not contested, just clean makes
3. Write down everything you remember from the last time you were in rhythm: routine, sleep, mindset. Compare it to now.`,
  },
  {
    question: "I'm terrified to take the big shot when the game is on the line.",
    answer: `Fear of the big shot comes from making the outcome mean something about you. If you miss, you're not good enough. If you make it, you are. That's the trap that locks you up.

The players who take big shots consistently have separated the shot from their identity. They've decided ahead of time that they're a shooter, regardless of results. That decision gets made in practice, not in the fourth quarter.

Try this before your next game: decide in advance that you're going to take every open look that comes your way, regardless of the score or the situation. Not because you'll always make it — because you're training your brain that the shot is safe to take.

I've been in EuroLeague finals. NBA games where everything was on the line. The players who wanted the ball in those moments weren't fearless — they'd just rehearsed taking the shot so many times that the game moment felt familiar. Pressure is just practice without the crowd. Make practice feel like pressure and the game will feel like practice.`,
    action_steps: `1. In your next five practices, take every open shot you get — no hesitation, no thinking
2. Before your next game, say out loud: "I want the ball in the fourth quarter." Say it to yourself. Mean it.
3. When the moment comes, focus only on your release point — nothing else. One thought.`,
  },
  {
    question: "I work harder than everyone on my team but I'm still not getting playing time.",
    answer: `Working hard is necessary. It is not sufficient. I've seen the hardest working player on every team I've been on not start. The coaches saw the work. They still made the call.

Here's what's almost always true: you're working hard on the things that make you feel good, not the things your coach actually values. That's not laziness — it's just a mismatch nobody's talked to you about.

Go watch ten minutes of film on your team's starter at your position. Not to compare yourself. To make a list. Write down exactly what he does that you don't. Where does he position himself defensively? What decisions does he make without the ball? How does he communicate?

That list is your practice plan for the next month. Not more reps of what you already do well. Reps of what your coach is actually watching for.

Hard work with direction is different from hard work alone. You've proven you have the work ethic. Now aim it.`,
    action_steps: `1. Watch film of the player starting ahead of you — write down 3 specific things they do that you don't
2. Bring that list to your coach and ask: "Is this what you're looking for from me?"
3. For the next 30 days, spend 20 minutes per practice on those exact three things`,
  },
  {
    question: "I lost my passion for basketball. I don't even want to play anymore.",
    answer: `Burnout almost always comes from playing for someone else's reasons. Your parents. Your coach. The scholarship. The attention. The identity you built around the sport. When the external pressure outweighs the internal joy, the love fades.

I went through this in my second year in Europe. I had achieved things I'd worked my whole life for and I felt nothing. I had to strip everything back and ask myself one question: if nobody was watching — no scouts, no parents, no future on the line — would I still play?

The answer was yes. And that yes was enough to rebuild from.

If your answer is also yes, you haven't lost your love for the game. You've lost your love for the pressure that surrounds it. Those are different problems with different solutions.

Take one week and play with no agenda. Pick-up runs, shoot around alone, play with kids younger than you. Remember what the ball felt like before it meant something. You don't need to rediscover your passion from scratch — you just need to separate the game from what's been attached to it.`,
    action_steps: `1. This week, play one session with zero agenda — no drills, no goals, just play
2. Write down the answer to this question honestly: "If nobody was watching, would I still play?"
3. Tell one person you trust what's actually going on — not your coach, someone safe`,
  },
  {
    question: "I can't sleep the night before big games. My anxiety takes over.",
    answer: `Pre-game anxiety the night before is your body preparing. Most players fight it. That's the mistake. You can't suppress energy — you can only redirect it.

When I couldn't sleep before big games, I stopped trying to force sleep and started working with what my body was giving me. Lying there trying to turn off your brain makes it louder. Instead, give your brain something specific to do.

Try this: starting from your feet, tense each muscle group for five seconds, then release completely. Feet. Calves. Thighs. Core. Chest. Shoulders. By the time you reach your neck, your body has physically released the tension it was holding. Most nights I was asleep before I finished.

The other piece is what you do at 4pm the day before a game. That's when the anxiety actually starts. Protect that window. No social media, no film of the opponent, no conversations that fire up your nervous system. Do something completely unrelated to basketball for two hours. Your brain needs a break before it can be sharp.

The players who perform best in big games aren't calm. They've learned to channel the energy instead of fight it.`,
    action_steps: `1. Tonight: try the muscle tension release technique — tense and release each muscle group from feet to shoulders
2. The day before your next game, protect the 4-6pm window — no opponent film, no social media, no basketball talk
3. Write down three things you're looking forward to about the game, not worried about. Read them before bed.`,
  },
  {
    question: "My teammates don't respect me and it's affecting how I play.",
    answer: `You can't control what your teammates believe about you. Trying to win their respect directly — by talking about it, by playing angry, by forcing moments — almost always makes it worse.

What you can control is what you give them evidence for. Every practice. Every game. Not to prove something. To be something.

Here's what I've seen in every locker room at every level: respect is almost never given. It's accumulated. Quietly. Over time. The players who earn it fastest are the ones who stop thinking about the respect and just go to work on what's in front of them.

There's also something worth asking yourself honestly: is this about respect, or is it about a specific player or moment? Because if it's one person, that's a conversation worth having — directly, privately, without the team watching. If it's the whole team, the question becomes: what's one thing I can do consistently that makes this team better? Not flashy. Consistent.

The teammates who doubted me in my career were watching closely. I just never gave them my energy. Give your energy to the game.`,
    action_steps: `1. For the next two weeks, say nothing about the respect situation — no complaints, no confrontations, no energy on it
2. Identify one consistent thing you can do that makes your team better — a screen, a defensive assignment, a communication habit
3. If it's one specific teammate, have one direct private conversation — not about respect, about the team`,
  },
  {
    question: "My coach yells at me in front of everyone and it completely shuts me down. How do I not let it get in my head?",
    answer: `A coach who yells publicly is trying to send a message — sometimes to you, sometimes to the whole team. But what it does to you mentally is real, and ignoring it doesn't make it go away.

Here's what I learned playing under high-pressure coaches at the highest levels: the yelling isn't the problem. Your relationship with the yelling is. When a coach yells and you shut down, you've handed them control of your nervous system. They don't even know they have it.

The shift that changed everything for me: I started treating every correction — yelled or not — as information, not judgment. "Get back on defense" means get back on defense. It doesn't mean you're a bad player, or that he doesn't believe in you, or that your career is over. It means get back on defense.

This takes practice. Start in low-stakes moments. When a coach corrects you in practice, say to yourself: "What's the adjustment?" Not "what does this mean about me?" Just the adjustment.

The other piece: if the yelling is genuinely affecting your ability to play and it's crossed a line, that's a conversation worth having — privately, calmly, one-on-one. Not to complain. To communicate. "Coach, I play better when I understand what you need from me. Can we talk about that?" Most coaches respect that more than silence.`,
    action_steps: `1. Next practice: when you get corrected, immediately ask yourself "what's the adjustment?" — not what it means about you
2. For the next two weeks, separate every piece of coaching from your self-worth. It's information. Act on it.
3. If it's beyond coaching and feels personal, request a private meeting — come with specific examples and a specific ask`,
  },
  {
    question: "I had one bad game and I can't stop replaying it. I'm scared it's going to happen again.",
    answer: `The replay loop is your brain trying to solve an unsolved problem. It keeps returning to the moment because it hasn't found resolution. The bad news: trying to stop thinking about it usually makes it worse. The good news: there's a way through it that actually works.

First, give yourself 24 hours. One full day to feel it, talk about it if you need to, let it be bad. Don't suppress it. Don't pretend it didn't matter. It did. That's fine.

After 24 hours, do this: write down exactly what happened, what you'd do differently, and one thing you did well in the same game. Not to torture yourself — to close the loop. Your brain keeps replaying because it hasn't filed the experience away. Writing it down tells your brain: I've processed this. We can move on.

Then there's the fear it'll happen again. That fear is actually useful if you aim it correctly. It means you care. Use it to prepare specifically for the situation that broke down. If you turned it over late in the game, spend ten minutes in your next practice on late-game decision making. Make the fear specific. Then make the specific thing smaller.

One bad game doesn't predict the next one. But how you handle it does.`,
    action_steps: `1. Give yourself 24 hours to fully feel it — no suppression, no pretending it's fine
2. After 24 hours: write down what happened, what you'd do differently, and one thing you did well
3. Identify the specific moment that broke down and spend 10 minutes in your next practice on exactly that situation`,
  },
  {
    question: "Am I actually good enough for the next level? I don't know if I'm just fooling myself.",
    answer: `This question is the bravest one a player can ask — and most are too scared to ask it honestly.

Here's what I've seen from the inside: almost every player who makes it to the next level asked this question. And almost every player who didn't make it never asked it seriously. The asking is a good sign.

The honest answer: "good enough" isn't a fixed thing. It's a moving target that depends on your development rate, not your current ceiling. The players who make it aren't always the most talented ones in the gym right now. They're the ones who are still getting better when everyone else has plateaued.

What I'd ask instead: are you getting better every month? Not every day — every month? Is the gap between you and the players ahead of you shrinking or growing? If it's shrinking, the answer might be yes. If it's growing, the question isn't about your ceiling — it's about your process.

Get honest evaluation from people who have no emotional stake in your answer. Not your parents. Not your closest friends. A coach who's seen the next level. Put your film in front of people who will tell you the truth.

The question "am I good enough" can either paralyze you or fuel you. The difference is whether you follow it with: "and what am I going to do about it today?"`,
    action_steps: `1. Find one person who has seen the next level and ask them for an honest evaluation — be specific about what you want feedback on
2. Track your progress monthly: pick three measurable things and track them for 90 days
3. Spend 20 minutes writing the honest answer to this question: "What would I need to change to give myself the best shot?"`,
  },
  {
    question: "Basketball is my whole identity. When I have a bad game, I feel like I'm nothing. How do I stop letting it define me?",
    answer: `This is the most important mental performance question a player can ask, and almost none of them do — because admitting it out loud feels like weakness. It's not. It's the most honest thing you can say.

When basketball is your entire identity, every game becomes an evaluation of your worth as a person. Not just your skills — your worth. That's an unbearable amount of pressure to put on a game.

I've been there. Every player at the professional level has been there. The ones who last have learned — usually the hard way — that basketball is something they do, not who they are.

Here's what helped me: I started building a version of myself that existed completely outside the game. One thing I was curious about, one relationship that had nothing to do with basketball, one skill I was developing that had zero to do with sports. Not as a backup plan. As proof that I existed beyond the sport.

When you have that, a bad game hurts. But it doesn't erase you. Because you know who you are when you're not on the court.

The pressure you feel isn't coming from the game. It's coming from the absence of yourself outside of it. Build that and everything else gets easier — including the game.`,
    action_steps: `1. This week: identify one thing you're interested in that has nothing to do with basketball. Spend 30 minutes on it.
2. Write down three things that are true about you that have nothing to do with how you play
3. After your next bad game: wait two hours, then call or text someone you trust about something completely unrelated to basketball`,
  },
  {
    question: "Everyone on my team is getting better faster than me. I feel like I'm getting left behind.",
    answer: `Comparison to teammates is one of the most damaging things a player can do to their own development — and one of the hardest to stop, because it feels like useful information. It's not. It's noise.

Here's what's actually happening when you compare: you're watching someone else's highlight reel and comparing it to your behind-the-scenes. You see their improvement. You don't see their struggle. You're measuring their outside against your inside. It's a rigged comparison.

I've been on teams where I was clearly behind the curve. EuroLeague. NBA camps. Those environments exposed every gap in my game. And the players who improved fastest were the ones who stopped looking sideways and locked into their own process.

The question that's worth asking isn't "why are they getting better faster?" It's "am I getting better?" Just you. Compared to last month. Last season.

Pick three things you want to be measurably better at in 90 days. Track those three things. Nothing else. When you're focused on your own growth curve, theirs becomes irrelevant — not because you don't care, but because you've stopped giving it your attention.

The race isn't against them. It's against who you were yesterday.`,
    action_steps: `1. Stop tracking your teammates' improvement for 30 days — completely
2. Pick three specific things to get better at in the next 90 days. Write them down.
3. At the end of each week, ask yourself: am I better at these three things than I was last week? That's the only comparison that matters`,
  },
]

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  let inserted = 0
  const errors: string[] = []

  for (const q of SEED_QUESTIONS) {
    // Check if this question already exists
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .ilike('question', q.question.slice(0, 30) + '%')
      .limit(1)

    if (existing && existing.length > 0) {
      errors.push(`Skipped (already exists): ${q.question.slice(0, 40)}`)
      continue
    }

    const { error } = await supabase.from('questions').insert({
      question: q.question,
      answer: q.answer,
      action_steps: q.action_steps,
      status: 'approved',
      email: 'seed@elijahbryant.pro',
      ip: 'seed',
      sources: [],
    })

    if (error) {
      errors.push(`Failed: ${q.question.slice(0, 40)} — ${error.message}`)
    } else {
      inserted++
    }
  }

  return NextResponse.json({ inserted, skipped: errors.filter(e => e.startsWith('Skipped')).length, errors })
}
