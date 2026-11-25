// @ts-check
/**
 * The officially assigned ISO 3166-1 alpha-2 country codes (ADR-0086 decision 2).
 *
 * Source: the ISO 3166 Maintenance Agency's list of officially assigned alpha-2
 * codes, 249 entries. Reviewed 2026-11-25, and cross-checked against the region
 * names in Node's ICU data (every code below has one).
 *
 * Deliberately absent, so a sub-processor `location` that uses them is rejected:
 * - exceptionally reserved codes such as `EU`, `UK` (write `GB`), `UN`, `EZ`;
 * - transitionally reserved and withdrawn codes such as `AN`, `CS`, `YU`;
 * - user-assigned codes: `AA`, `QM`–`QZ`, `XA`–`XZ` (including `XK`), `ZZ`.
 * ⚖ counsel: whether `EU` or `XK` should be accepted is an open question.
 *
 * The list changes rarely. A change is a one-line edit plus the size assertion in
 * `subprocessors-core.test.ts`. It is embedded rather than taken from a package
 * so the catalog adds no dependency (DIRECTIVE_051) and cannot drift with an ICU
 * build.
 *
 * @module subprocessors-iso3166
 */

/**
 * A read-only view: `has` and `size` only. A frozen `Set` would still accept
 * `add`, so the set itself stays private to this module.
 *
 * @typedef {{ readonly size: number, has(code: string): boolean }} CodeList
 */

const CODES = new Set(
    `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
     BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
     CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
     DE DJ DK DM DO DZ
     EC EE EG EH ER ES ET
     FI FJ FK FM FO FR
     GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
     HK HM HN HR HT HU
     ID IE IL IM IN IO IQ IR IS IT
     JE JM JO JP
     KE KG KH KI KM KN KP KR KW KY KZ
     LA LB LC LI LK LR LS LT LU LV LY
     MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
     NA NC NE NF NG NI NL NO NP NR NU NZ
     OM
     PA PE PF PG PH PK PL PM PN PR PS PT PW PY
     QA
     RE RO RS RU RW
     SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
     TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
     UA UG UM US UY UZ
     VA VC VE VG VI VN VU
     WF WS
     YE YT
     ZA ZM ZW`.split(/\s+/),
);

/** @type {CodeList} */
export const ISO3166_ALPHA2 = Object.freeze({ size: CODES.size, has: (/** @type {string} */ code) => CODES.has(code) });
