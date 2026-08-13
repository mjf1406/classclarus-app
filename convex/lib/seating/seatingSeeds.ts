/** Fixed, varied 32-bit seeds shared with the equitable assigner soak style. */
export const SEATING_SIMULATION_SEEDS = [
  0x0000_0001, 0x0000_00ad, 0x0000_162e, 0x0000_beef, 0x0001_2345, 0x0010_c0de, 0x00a5_5a5a,
  0x0123_4567, 0x0bad_f00d, 0x0f0f_0f0f, 0x1111_1111, 0x1234_abcd, 0x1a2b_3c4d, 0x2468_ace0,
  0x3141_5926, 0x3c6e_f372, 0x4141_4141, 0x4a7b_c9de, 0x5555_aaaa, 0x5e87_9b2c, 0x60d5_e8a1,
  0x6d2b_79f5, 0x7f4a_2c91, 0x89abcdef, 0x90abcdef, 0x9e3779b9, 0xa5a5_a5a5, 0xb16b_00b5,
  0xc0ffee00, 0xcafebabe, 0xd00d_face, 0xdead_beef, 0xe1e2_e3e4, 0xefcd_ab89, 0xf0e1_d2c3,
  0xf7c2_a1b0, 0xfeed_face, 0xff00_ff00, 0xffff_0001, 0xffff_fffe,
] as const;

export function seatingSoakEnabled(): boolean {
  return process.env.SEATING_SOAK === "1";
}

export function seatingSimulationSeeds(): readonly number[] {
  return seatingSoakEnabled() ? SEATING_SIMULATION_SEEDS : SEATING_SIMULATION_SEEDS.slice(0, 8);
}

export function seatingSimulationRuns(defaultRuns: number, soakRuns = 50): number {
  return seatingSoakEnabled() ? soakRuns : defaultRuns;
}
