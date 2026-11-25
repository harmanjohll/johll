// Scam check. A plain rule check for the common signs of a scam message.
// It is not an AI, it knows only familiar patterns, and it never stores what it is shown.
// It advises; it never blocks, and it should never be anyone's only defence.

const SIGNS = [
  { id: 'codes', weight: 3, label: 'Asks for a one time code, card details or Singpass', re: /\b(otp|one[ -]?time (password|pin|code)|verification code|security code|\d[ -]?digit code|cvv|card number|singpass|login details|internet banking (id|password)|ibanking)\b/i },
  { id: 'remote', weight: 3, label: 'Asks you to install an app or share your screen', re: /\b(anydesk|teamviewer|screen ?shar(e|ing)|remote access|install (this|the|an|our) app|download (this|the|an|our) (app|apk|file)|\.apk\b)/i },
  { id: 'impersonation', weight: 2, label: 'Someone you know, suddenly on a new number', re: /\b(new (number|phone|hp|handphone)|changed? my number|lost my phone|phone (is |got )?(broken|spoilt|spoiled|dropped|stolen)|this is my new|save (this|my new) number|guess who|it'?s me,? (your|ur))\b/i },
  { id: 'secrecy', weight: 2, label: 'Tells you to keep it secret or stay on the line', re: /\b(do ?n[o']t tell|don't tell|keep (this |it )?(a )?secret|between (us|you and me)|strictly confidential|do not hang up|stay on the (line|call))\b/i },
  { id: 'prize', weight: 2, label: 'A prize, easy money or a job you did not apply for', re: /\b(you(?:'ve| have)? won(?!['\u2019])|lucky draw|free gift|claim your (prize|reward)|guaranteed (returns?|profit)|investment opportunity|easy money|part[ -]?time job|earn \$?\d+ (a|per) day|high commission)\b/i },
  { id: 'money', weight: 1, label: 'Asks for money or a transfer', re: /\b(transfer|paynow|pay ?now|remit|wire|deposit|top[ -]?up|gift cards?|bank account|send (me |us )?(money|cash|\$)|crypto|bitcoin|usdt)\b|[s]?\$\s?\d/i },
  { id: 'urgency', weight: 1, label: 'Pressure to act at once', re: /\b(urgent(ly)?|immediately|right now|asap|act now|within \d+ ?(min|minutes|hours?|hrs?)|last chance|final (notice|warning|reminder)|expires? (today|soon|in)|(will be|has been|is) (suspended|locked|frozen|blocked|closed|terminated))\b/i },
  { id: 'link', weight: 1, label: 'Contains a link', re: /(https?:\/\/|www\.|\bbit\.ly|\btinyurl|\bt\.me\/|\bwa\.me\/|\b[a-z0-9-]+\.(xyz|top|click|link|info|cc|tk|ru|shop|live|site)\b)/i },
  { id: 'authority', weight: 1, label: 'Claims to be a bank, a delivery firm or the authorities', re: /\b(police|spf|mas|iras|cpf|ica|ministry|court|customs|officer|dbs|posb|ocbc|uob|citibank|hsbc|standard chartered|singpost|ninja ?van|lazada|shopee|your (bank|parcel|package|account))\b/i },
];

// Some pairs are worse together than apart.
const COMBOS = [
  { a: 'authority', b: 'link', extra: 2, label: 'Banks and agencies here do not send links to click' },
  { a: 'impersonation', b: 'money', extra: 1, label: 'A new number together with a request for money is the classic pattern' },
  { a: 'prize', b: 'link', extra: 1, label: 'An offer with a link to claim it' },
];

export const HELPLINE = '1799';

const STEPS = {
  likely: ['Do not reply, click or pay.', 'If it claims to be someone you know, call them on the number you already have.', `Not sure? Call the ScamShield helpline on ${HELPLINE}.`, 'If money has already moved, call your bank now and ask for its kill switch.'],
  caution: ['Pause before you act on it.', 'Check with the person or the organisation on a number you already have, not one in the message.', `The ScamShield helpline is ${HELPLINE}.`],
  clear: ['None of the usual signs.', 'This check only knows common patterns. If anything feels off, call the person back on a number you already have.'],
};

export function checkScam(text) {
  const t = String(text || '');
  const found = SIGNS.filter((s) => s.re.test(t));
  const ids = new Set(found.map((s) => s.id));
  const combos = COMBOS.filter((c) => ids.has(c.a) && ids.has(c.b));
  const score = found.reduce((n, s) => n + s.weight, 0) + combos.reduce((n, c) => n + c.extra, 0);
  let verdict = 'clear';
  if (score >= 4 || ids.has('codes') || ids.has('remote')) verdict = 'likely';
  else if (score >= 2) verdict = 'caution';
  return {
    verdict,
    score,
    signs: [...found.map((s) => s.label), ...combos.map((c) => c.label)],
    steps: STEPS[verdict],
    headline: { likely: 'This looks like a scam', caution: 'Be careful with this', clear: 'No usual signs of a scam' }[verdict],
  };
}

// Invented examples for trying the check. None is a real message.
export const SCAM_EXAMPLES = [
  { label: 'A new number', text: 'Hi Mum, I dropped my phone and this is my new number. Can you transfer $850 to this account now? It is urgent, I will explain later.' },
  { label: 'A bank alert', text: 'DBS: Your account has been suspended due to unusual activity. Verify within 24 hours at http://dbs-secure-verify.xyz to avoid closure.' },
  { label: 'A code request', text: 'This is the delivery officer. To release your parcel please read me the 6 digit code sent to your phone.' },
  { label: 'An ordinary message', text: 'Running a bit late, home by 7. Can you start the rice?' },
];
