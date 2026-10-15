// Static vocabulary for the seed generator. Team names for Monday and Wednesday are the real
// Spring 2026 teams from the league spreadsheet; the others are original.
export const NIGHT_TEAMS: Record<number, string[]> = {
  1: ["Old Pucks", "Keep It On The Board", "Anywhere But Home", "Disky Business", "New Puckers", "Lite Work"],
  2: ["Puck Dynasty", "Board to Death", "The Hangers-On", "Slide Rules", "Weights & Measures", "Fayette Street Flingers"],
  3: ["we suck, throwing pucks", "Conshy Shuffle", "Random Rollers", "Wax On, Wax Off", "Quate A Minute", "Silverado"],
  4: ["Sandbaggers", "Rolling Blackouts", "Shuffle Kings", "Dust Bunnies", "Matson Street Slides", "The Wax Poets"],
  5: ["Friday Night Slides", "Puckin' Around", "The Nightcaps", "Hang Time", "Elm Street Elite", "Last Call Legends"],
};

export const TEAM_COLORS = ["#2f8f5f", "#d4a73a", "#5ea8ff", "#e0a060", "#c86dd7", "#3dd68c", "#ff7a59", "#7f97ff"];

export const FIRST = ["Mike", "Dana", "Chris", "Pat", "Kelly", "Jordan", "Sam", "Alex", "Casey", "Taylor", "Morgan", "Jamie", "Riley", "Drew", "Shannon", "Terry", "Robin", "Devin", "Frankie", "Jesse",
  "Nick", "Tony", "Maria", "Steph", "Kevin", "Brian", "Megan", "Erin", "Sean", "Colleen", "Matt", "Joe", "Dan", "Katie", "Lauren", "Ryan", "Tom", "Jen", "Rob", "Kristen",
  "Ang", "Vince", "Lou", "Gina", "Dom", "Carm", "Rosie", "Sal", "Teresa", "Marco", "Nina", "Bobby", "Jackie", "Ray", "Donna", "Eddie", "Tina", "Paulie", "Linda", "Gus"];
export const LAST = ["Costanza", "Delgado", "Brennan", "Okafor", "Kowalski", "Nguyen", "Rizzo", "McCarthy", "Patel", "Romano", "Fitzgerald", "Mendez", "Schultz", "Byrne", "Esposito", "Walsh", "Caruso", "Donnelly",
  "Russo", "Gallagher", "Marino", "Kaminski", "DiMarco", "Sweeney", "Ferraro", "Quinn", "Lombardi", "Doyle", "Santoro", "Flynn", "Greco", "Reilly", "Vitale", "Murphy", "Bianchi", "Kelleher", "Moretti", "Hogan",
  "Testa", "Nolan", "Palumbo", "Burke", "Ricci", "Dunphy", "Conti", "Shea", "Amato", "Lynch", "Pizzo", "Cahill", "Grasso", "Toomey", "Barone", "Keane", "Mancini", "Duffy", "Serrano", "Tran", "Yoder", "Haddad"];
export const NICKS = ["Hanger", "The Closer", "Slick", "Big Weight", "Smooth", "Wax", "Sandman", "Leftie", "The Wall", "Puck Daddy", "Shorty", "Doc", "Bones", "Mayor", "Coach", "Rook", "Ace", "Flash", "Chief", "Pops"];

export const TRASH_TALK = [
  "Who left their weights in the gutter tonight? 👀",
  "Board was fast. Not as fast as our exit after game 2 though.",
  "Hanger on my first throw. Retiring undefeated for the night.",
  "{team} talking a lot for a team that lost 15–3.",
  "Somebody wax the board, I'm sliding into the parking lot.",
  "Rematch next week. Bring a mop for your tears.",
  "Shoutout to the bartender for the pretzel assist.",
  "We'll take the W and the last of the wings.",
  "Three hangers in one game should be illegal.",
  "If anyone finds a red weight, it's ours. Long story.",
  "GG {team}. See you in the final.",
  "That last frame was robbery and everyone knows it.",
  "Who's subbing for us Thursday? Reward: one (1) beer.",
  "Standings don't lie. Well, they do until we play you.",
  "New rule: no gloating before the second game.",
  "Our captain fell asleep during the lineup discussion. Still won.",
  "{team} we see you in the standings. Enjoy it while it lasts.",
  "Board 2 is cursed. Board 1 is also cursed. Love this place.",
  "Confirmed the score before I even sat down. Efficiency.",
  "Hanger of the week is mine. Save the trophy.",
];

export const LEAGUE_CHAT = [
  "Welcome to Fall 2026 everybody! Dues are $40, see Dana at the bar.",
  "Reminder: club is closed Thanksgiving week, make-ups to be scheduled.",
  "Who wants to run a Saturday doubles tournament in November?",
  "Shoutout to the Monday crew for the fastest night of scoring so far.",
  "Does anyone else's thumb hurt after three games or is it just me",
  "Banquet date is set — RSVP on the Events tab!",
  "The new scoring app is 100x better than the QR form. Finally.",
  "Friendly reminder that trash talk stays in the trash talk rooms.",
];

export const EVENTS = [
  { title: "Fall Playoffs begin", kind: "playoffs", weekOffset: 10, weekday: 1, time: "18:00", location: "Conshohocken Bocce Club", description: "Top four on each night. 1 v 4 and 2 v 3, same scoring rules, same bar." },
  { title: "Halloween Shuffle Social", kind: "social", weekOffset: 2, weekday: 6, time: "19:00", location: "Conshohocken Bocce Club", description: "Costumes encouraged, hangers mandatory. Open boards all night, prizes for best team costume." },
  { title: "Saturday Doubles Tournament", kind: "tournament", weekOffset: 5, weekday: 6, time: "13:00", location: "Conshohocken Bocce Club", description: "Blind-draw doubles. $10 per player, winner takes the pot and eternal glory. Sign up by Thursday." },
  { title: "Champion of Champions Night", kind: "playoffs", weekOffset: 12, weekday: 5, time: "18:00", location: "Conshohocken Bocce Club", description: "The five night champions settle it. Everyone is welcome to watch." },
  { title: "End of Season Banquet", kind: "banquet", weekOffset: 13, weekday: 6, time: "18:30", location: "Conshohocken Bocce Club, upstairs hall", description: "Awards, dinner, trophies and the Hanger of the Season. Plus-ones welcome." },
  { title: "Dues deadline", kind: "deadline", weekOffset: 0, weekday: 5, time: "23:00", location: null, description: "Last day to pay Fall dues ($40). Unpaid players are ineligible for playoffs." },
];

export const BADGES = [
  { slug: "first_hanger", name: "First Hanger", description: "Scored your first hanger in a live-scored game.", icon: "zap" },
  { slug: "hat_trick", name: "Hat Trick", description: "Three hangers in a single game.", icon: "flame" },
  { slug: "shutout", name: "Shutout", description: "Won a game without giving up a point.", icon: "shield" },
  { slug: "comeback_kid", name: "Comeback Kid", description: "Won a game after trailing by 8 or more.", icon: "trending-up" },
  { slug: "sweep", name: "Clean Sweep", description: "Won a match in straight games.", icon: "broom" },
  { slug: "first_win", name: "First Win", description: "Your team's first match win of the season.", icon: "trophy" },
  { slug: "streak_5", name: "Heater", description: "Five match wins in a row.", icon: "flame" },
  { slug: "streak_10", name: "Unstoppable", description: "Ten match wins in a row.", icon: "crown" },
  { slug: "giant_slayer", name: "Giant Slayer", description: "Beat a team ranked at least three places above you.", icon: "sword" },
  { slug: "iron_thumb", name: "Iron Thumb", description: "Played in every match of a season.", icon: "hand" },
];

export const BLOCKED_WORDS = ["nigger", "nigga", "faggot", "fag", "retard", "retarded", "kike", "spic", "chink", "wetback", "tranny", "dyke", "gook", "raghead", "towelhead", "beaner", "coon", "jap"];
