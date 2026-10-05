// Words a Top 10 name may not contain. Checked after lower-casing, removing accents and turning
// look-alike digits back into letters (so "5h1t" counts as "shit"), and with repeated letters squeezed.

// Rude anywhere in a name, even joined to other letters.
export const BLOCK_ANYWHERE = [
  'fuck', 'fuk', 'fck', 'shit', 'cunt', 'bitch', 'biatch', 'whore', 'slut', 'pussy', 'penis', 'vagina', 'twat',
  'bollock', 'bastard', 'asshole', 'arsehole', 'motherf', 'dildo', 'porn', 'rapist', 'hitler', 'nigg', 'faggot',
  'fagot', 'retard', 'tranny', 'chink', 'wetback', 'kkk', 'jizz', 'boob', 'horny', 'blowjob', 'handjob', 'killyou',
];

// Only rude as a whole word, because the letters also appear inside ordinary words and names
// (Cassandra, Dickens, Hancock, Grape, Spice, Essex, Janus, Torpedo, Nazia...).
export const BLOCK_WHOLE = [
  'ass', 'arse', 'tit', 'tits', 'fag', 'hoe', 'poop', 'crap', 'damn', 'hell', 'piss', 'prick',
  'nob', 'knob', 'cock', 'dick', 'wank', 'cum', 'sex', 'sexy', 'anal', 'anus', 'nude', 'rape', 'pedo', 'nazi', 'kys',
  'lesbo', 'dyke', 'slag', 'skank', 'thot', 'milf', 'coon', 'gook', 'jap', 'paki', 'wop', 'nig',
  'niga', 'spic', 'kike',
];
