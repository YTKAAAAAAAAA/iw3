import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAddress } from './address.ts'
import { osrmTableUrl, parseNominatimPoint, parseOsrmTable, parsePdokPoint, routeToSite } from './services.ts'

test('PDOK centroids are read as latitude and longitude', () => {
  const body = { response: { docs: [{ type: 'adres', centroide_ll: 'POINT(4.75163708 52.398726)' }] } }
  assert.deepEqual(parsePdokPoint(body), { lat: 52.398726, lon: 4.75163708 })
  assert.equal(parsePdokPoint({ response: { docs: [] } }), null)
  assert.equal(parsePdokPoint({ response: { docs: [{ centroide_ll: 'POINT(999 999)' }] } }), null)
})

test('Nominatim results are read as numbers', () => {
  assert.deepEqual(parseNominatimPoint([{ lat: '52.37', lon: '4.89' }]), { lat: 52.37, lon: 4.89 })
  assert.equal(parseNominatimPoint([]), null)
})

test('the OSRM table request routes every home to the site in one call', () => {
  const url = osrmTableUrl('https://osrm.example/', { lat: 52.4, lon: 4.75 }, [
    { lat: 52.3, lon: 4.9 },
    { lat: 52.1, lon: 5.1 },
  ])
  assert.equal(
    url,
    'https://osrm.example/table/v1/driving/4.750000,52.400000;4.900000,52.300000;5.100000,52.100000' +
      '?sources=1;2&destinations=0&annotations=distance,duration',
  )
})

test('OSRM metres and seconds become kilometres and minutes; unreachable homes are null', () => {
  const body = { code: 'Ok', distances: [[12345], [null]], durations: [[901], [null]] }
  assert.deepEqual(parseOsrmTable(body, 2), [{ km: 12.3, minutes: 15 }, null])
  assert.throws(() => parseOsrmTable({ code: 'InvalidQuery' }, 1))
})

test('large groups are routed in batches and kept in order', async () => {
  const calls: string[] = []
  const fakeFetch = (async (url: string) => {
    calls.push(url)
    const count = new URL(url).searchParams.get('sources')!.split(';').length
    return new Response(
      JSON.stringify({
        code: 'Ok',
        distances: Array.from({ length: count }, (_, i) => [1000 * (i + 1)]),
        durations: Array.from({ length: count }, () => [60]),
      }),
    )
  }) as unknown as typeof fetch
  const homes = Array.from({ length: 5 }, (_, i) => ({ lat: 52 + i / 100, lon: 4.9 }))
  const legs = await routeToSite('https://osrm.example', { lat: 52.4, lon: 4.75 }, homes, fakeFetch, 2)
  assert.equal(calls.length, 3)
  assert.deepEqual(
    legs.map(leg => leg?.km),
    [1, 2, 1, 2, 1],
  )
})

test('addresses differing only in case and spacing share one cache key', () => {
  assert.equal(
    normalizeAddress('  Havenstraat 12 A  1234AB  Amsterdam'),
    normalizeAddress('havenstraat 12 a 1234ab amsterdam'),
  )
})
