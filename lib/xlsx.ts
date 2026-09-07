/**
 * Minimal .xlsx writer.
 *
 * An .xlsx is a ZIP of XML parts, so a spreadsheet can be produced in the
 * browser with no dependency: entries are stored uncompressed (method 0) and
 * cells use inline strings, which removes the need for a shared-string table.
 * Numbers are written as numbers so Excel can sum them.
 */

function crc32Table() {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
}
const TABLE = crc32Table()

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ TABLE[(crc ^ bytes[i]) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

function zip(entries: { name: string; text: string }[]) {
  const enc = new TextEncoder()
  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff]
  const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  let centralSize = 0

  for (const { name, text } of entries) {
    const nameBytes = enc.encode(name)
    const data = enc.encode(text)
    const sum = crc32(data)
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(sum), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0),
    ])
    parts.push(local, nameBytes, data)
    const head = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(sum), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length),
      ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ])
    central.push(head, nameBytes)
    centralSize += head.length + nameBytes.length
    offset += local.length + nameBytes.length + data.length
  }

  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ])
  return new Blob([...parts, ...central, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const columnName = (index: number) => {
  let name = ''
  let n = index
  do { name = String.fromCharCode(65 + (n % 26)) + name; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return name
}

/* ------------------------------------------------------------------
   Styles.

   The client's weekly sheet is not a bare grid — dates in their blue, hours
   on a pale fill inside a border, a bold company name across the top — and a
   report that arrives looking like something else gets retyped by hand at the
   other end. So the writer carries a small fixed style table, in the same
   order the indices below assume; nothing here is dynamic, which keeps
   styles.xml a constant string.
   ------------------------------------------------------------------ */
export type StyleName = 'default' | 'title' | 'meta' | 'label' | 'accent' | 'date' | 'head' | 'headLeft' | 'text' | 'hours' | 'total' | 'sum'
const STYLE_INDEX: Record<StyleName, number> = {
  default: 0, title: 1, meta: 2, label: 3, accent: 4, date: 5,
  head: 6, headLeft: 7, text: 8, hours: 9, total: 10, sum: 11,
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="DD-MM-YYYY"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>
<fonts count="6">
<font><sz val="10"/><name val="Arial"/></font>
<font><b/><sz val="12"/><name val="Arial"/></font>
<font><sz val="10"/><color rgb="FF003366"/><name val="Arial"/></font>
<font><b/><sz val="10"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FF4F81BD"/><name val="Arial"/></font>
<font><sz val="10"/><color rgb="FF4F81BD"/><name val="Arial"/></font>
</fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFCCFFFF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="5" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="165" fontId="5" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="165" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

/** A cell: a bare value, or a value with a style, a formula, or a date. */
export type Cell =
  | string | number | null
  | { v?: string | number | null; f?: string; date?: string; s?: StyleName }

export type SheetSpec = {
  name: string
  rows: Cell[][]
  /** Column widths in Excel units, by column index; undefined leaves default. */
  cols?: (number | undefined)[]
  /** How many rows stay pinned at the top when the sheet scrolls. */
  freezeRows?: number
}

/** Excel counts days from 1899-12-30 (the leap-year bug of 1900 included). */
const excelSerial = (iso: string) =>
  Math.round((new Date(`${iso}T12:00:00Z`).getTime() - Date.UTC(1899, 11, 30, 12)) / 86400000)

function cellXml(cell: Cell, ref: string): string {
  if (cell === null || cell === undefined || cell === '') return ''
  const spec = typeof cell === 'object' ? cell : { v: cell }
  const style = spec.s ? ` s="${STYLE_INDEX[spec.s]}"` : ''
  if (spec.f) return `<c r="${ref}"${style}><f>${escapeXml(spec.f)}</f></c>`
  if (spec.date) return `<c r="${ref}"${style}><v>${excelSerial(spec.date)}</v></c>`
  if (spec.v === null || spec.v === undefined || spec.v === '') return style ? `<c r="${ref}"${style}/>` : ''
  return typeof spec.v === 'number'
    ? `<c r="${ref}"${style}><v>${spec.v}</v></c>`
    : `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(spec.v))}</t></is></c>`
}

export function buildXlsx(spec: SheetSpec) {
  const body = spec.rows
    .map((cells, r) => {
      const cols = cells.map((cell, c) => cellXml(cell, `${columnName(c)}${r + 1}`)).join('')
      return cols ? `<row r="${r + 1}">${cols}</row>` : ''
    })
    .join('')

  const cols = spec.cols?.length
    ? `<cols>${spec.cols.map((w, i) => (w ? `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>` : '')).join('')}</cols>`
    : ''
  const view = spec.freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${spec.freezeRows}" topLeftCell="A${spec.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : ''

  return zip([
    { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(spec.name)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', text: STYLES },
    { name: 'xl/worksheets/sheet1.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${view}${cols}<sheetData>${body}</sheetData></worksheet>` },
  ])
}

export function downloadXlsx(spec: SheetSpec, filename: string) {
  const url = URL.createObjectURL(buildXlsx(spec))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
