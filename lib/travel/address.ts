/** The key an address is cached under: case and spacing differences such as
 *  "Havenstraat 12 A" and "havenstraat  12 a" are the same place. */
export const normalizeAddress = (address: string) => address.trim().replace(/\s+/g, ' ').toLowerCase()
