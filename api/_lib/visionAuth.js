/**
 * visionAuth — BENDRAS vision-doc cookie token algoritmas.
 *
 * KODĖL: iki šiol identiškas `tokenFor()` + `PEPPER` buvo DUBLIUOTAS dviejose
 * saugumui kritinėse vietose:
 *   • middleware.js      (Edge — tikrina cookie prieš serv'indamas /vision/doc)
 *   • api/vision-unlock.js (Node — uždeda cookie po slaptažodžio validacijos)
 * Abiejų komentarai įspėja: „PEPPER + token algoritmas TURI tiksliai sutapti".
 * Dublikatas = drift'o rizika (pakeiti vienur, pamiršti kitur → gate lūžta
 * arba atsiveria). Dabar — vienas šaltinis, kurį dengia unit test'ai.
 *
 * SUDERINAMUMAS: naudoja TIK Web standartus (TextEncoder + crypto.subtle),
 * todėl veikia ir Node serverless, ir Edge middleware runtime'uose.
 */

export const PEPPER = 'lapasid-vision-v1'

/**
 * Deterministinis cookie token'as iš slaptažodžio.
 * token = SHA-256(PEPPER + ':' + password), hex.
 * Slaptažodis niekada nepatenka į klientą — cookie turi tik hash'ą.
 *
 * @param {string} password
 * @returns {Promise<string>} 64 simbolių hex SHA-256 digest
 */
export async function tokenFor(password) {
  const data = new TextEncoder().encode(PEPPER + ':' + String(password))
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
