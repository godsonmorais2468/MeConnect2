/**
 * Google Places, used to suggest venues as someone types and to read the chosen place's latitude and longitude.
 * The key comes from VITE_GOOGLE_MAPS_API_KEY. With no key nothing loads and the venue is a plain text box.
 */
interface Prediction {
  description: string
  place_id: string
  structured_formatting?: { main_text?: string; secondary_text?: string }
}

interface PlaceResult {
  geometry?: { location?: { lat(): number; lng(): number } }
}

interface PlacesApi {
  AutocompleteService: new () => {
    getPlacePredictions(request: { input: string; sessionToken?: unknown; componentRestrictions?: { country: string }; locationRestriction?: { north: number; south: number; east: number; west: number } }, done: (result: Prediction[] | null, status: string) => void): void
  }
  PlacesService: new (host: HTMLElement) => {
    nearbySearch(request: { location: { lat: number; lng: number }; rankBy: unknown; type: string }, done: (result: NearbyResult[] | null, status: string) => void): void
    getDetails(request: { placeId: string; fields: string[]; sessionToken?: unknown }, done: (result: PlaceResult | null, status: string) => void): void
  }
  AutocompleteSessionToken: new () => unknown
  PlacesServiceStatus: { OK: string }
  RankBy: { DISTANCE: unknown }
}

interface NearbyResult {
  name?: string
  vicinity?: string
}

type MapsWindow = Window & {
  google?: { maps?: { importLibrary?: (name: string) => Promise<unknown> } }
  __bniMapsReady?: () => void
}

export interface PlaceSuggestion {
  placeId: string
  /** The whole description, used as the venue text. */
  text: string
  main: string
  secondary: string
}

const KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim()

/**
 * Venues are only suggested in South India: Kerala, Tamil Nadu, Karnataka, Andhra Pradesh, Telangana and Puducherry.
 * Google cannot limit a search to states, so the search is kept inside India and a box around the south, and what comes
 * back is then checked for one of these state names (the box also reaches a little of Goa, Maharashtra and Odisha).
 */
const SOUTH_INDIA_BOX = { north: 20.0, south: 7.9, east: 85.0, west: 74.0 }
const SOUTH_INDIA_STATES = /\b(Kerala|Keralam|Tamil Nadu|Karnataka|Andhra Pradesh|Telangana|Puducherry|Pondicherry)\b/i

/** False when no key is set: the venue box then works as a plain text field. */
export const placesEnabled = Boolean(KEY)

let loading: Promise<PlacesApi | null> | null = null
let autocomplete: InstanceType<PlacesApi['AutocompleteService']> | null = null
let details: InstanceType<PlacesApi['PlacesService']> | null = null
/* One session token covers the typing and the final pick, which Google bills as a single search. */
let sessionToken: unknown = null

function loadPlaces(): Promise<PlacesApi | null> {
  if (!KEY) return Promise.resolve(null)
  if (!loading) {
    loading = new Promise<PlacesApi | null>((resolve) => {
      const w = window as MapsWindow
      const finish = async () => {
        try {
          resolve((await w.google?.maps?.importLibrary?.('places')) as PlacesApi)
        } catch {
          loading = null
          resolve(null)
        }
      }
      w.__bniMapsReady = () => void finish()
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&loading=async&callback=__bniMapsReady`
      script.async = true
      script.onerror = () => {
        loading = null
        resolve(null)
      }
      document.head.appendChild(script)
    })
  }
  return loading
}

/** Places that match what has been typed, best first. Empty when the service is not available. */
export async function suggestPlaces(input: string): Promise<PlaceSuggestion[]> {
  const places = await loadPlaces()
  if (!places) return []
  autocomplete ??= new places.AutocompleteService()
  sessionToken ??= new places.AutocompleteSessionToken()
  const service = autocomplete
  const token = sessionToken
  return new Promise((resolve) => {
    service.getPlacePredictions({ input, sessionToken: token, componentRestrictions: { country: 'in' }, locationRestriction: SOUTH_INDIA_BOX }, (result, status) => {
      if (status !== places.PlacesServiceStatus.OK || !result) return resolve([])
      resolve(
        result.filter((p) => SOUTH_INDIA_STATES.test(p.description)).slice(0, 6).map((p) => ({
          placeId: p.place_id,
          text: p.description,
          main: p.structured_formatting?.main_text ?? p.description,
          secondary: p.structured_formatting?.secondary_text ?? '',
        })),
      )
    })
  })
}

/** The latitude and longitude of a place picked from the suggestions, or null if it cannot be read. */
export async function placeLocation(placeId: string): Promise<{ lat: number; lng: number } | null> {
  const places = await loadPlaces()
  if (!places) return null
  details ??= new places.PlacesService(document.createElement('div'))
  const service = details
  const token = sessionToken
  sessionToken = null /* the pick ends the search: the next one starts a new session */
  return new Promise((resolve) => {
    service.getDetails({ placeId, fields: ['geometry'], sessionToken: token }, (place, status) => {
      const spot = place?.geometry?.location
      if (status !== places.PlacesServiceStatus.OK || !spot) return resolve(null)
      resolve({ lat: spot.lat(), lng: spot.lng() })
    })
  })
}

/**
 * The named places closest to a spot (nearest first), as venue text: "Hyatt Regency Trivandrum, CV Raman Pillai Road, Thycaud".
 * Used after "Use my current location" so the venue can be filled with where the person is standing.
 */
export async function nearbyPlaces(lat: number, lng: number): Promise<string[]> {
  const places = await loadPlaces()
  if (!places) return []
  details ??= new places.PlacesService(document.createElement('div'))
  const service = details
  return new Promise((resolve) => {
    service.nearbySearch({ location: { lat, lng }, rankBy: places.RankBy.DISTANCE, type: 'establishment' }, (found, status) => {
      if (status !== places.PlacesServiceStatus.OK || !found) return resolve([])
      const seen = new Set<string>()
      const out: string[] = []
      for (const place of found) {
        const name = place.name?.trim()
        if (!name || seen.has(name)) continue
        seen.add(name)
        /* Google sometimes gives a plus code ("9372+GCW, ...") as the street: drop that part */
        const area = (place.vicinity ?? '').replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,3},?\s*/, '').trim()
        out.push(area ? `${name}, ${area}` : name)
        if (out.length === 5) break
      }
      resolve(out)
    })
  })
}
