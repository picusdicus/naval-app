const CRTM_API_BASE = 'https://www.crtm.es/widgets/api/'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { codStop } = req.query

  if (!codStop) {
    return res.status(400).json({ error: 'codStop is required' })
  }

  try {
    const response = await fetch(
      `${CRTM_API_BASE}GetStopsTimes.php?codStop=${encodeURIComponent(codStop)}`
    )

    const data = await response.json()

    // Always return 200 OK with the CRTM response
    // The frontend will handle parsing errors gracefully
    res.status(200).json(data)
  } catch (error) {
    console.error('Error fetching from CRTM:', error)
    // Return 200 with error indicator so frontend can handle gracefully
    res.status(200).json({ error: 'Failed to fetch real-time data' })
  }
}
