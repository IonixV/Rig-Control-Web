// jbdubbs/hamlib-RCW carries local Xiegu G90 driver fixes not present
// upstream (see README-RCW.md in that repo) — every bundled bin/*/rigctld
// binary is built from it, so any from-source build must clone this fork,
// not vanilla Hamlib, or it silently ships a rigctld missing those fixes.
// The fork is private: HAMLIB_RCW_TOKEN (a PAT with read access)
// authenticates the clone in CI; local machines with their own git
// credentials for the repo (e.g. via `gh auth` or SSH) don't need it.
export function getHamlibRepoUrl() {
  return process.env.HAMLIB_RCW_TOKEN
    ? `https://x-access-token:${process.env.HAMLIB_RCW_TOKEN}@github.com/jbdubbs/hamlib-RCW.git`
    : "https://github.com/jbdubbs/hamlib-RCW.git";
}
