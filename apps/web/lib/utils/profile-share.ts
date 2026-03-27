export function buildProfileShareUrl(origin: string, username: string) {
  return new URL(`/stats/${username}`, origin).toString();
}

export function buildProfileShareText(username: string) {
  return [
    `My Claude Code stats on Straude`,
    `52 weeks of tracked work by @${username}`,
  ].join("\n");
}

export function buildProfileIntentUrl(origin: string, username: string) {
  const params = new URLSearchParams({
    text: buildProfileShareText(username),
    url: buildProfileShareUrl(origin, username),
  });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
