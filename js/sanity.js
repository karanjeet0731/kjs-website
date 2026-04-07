const client = {
  projectId: "nceyom8c",
  dataset: "production"
}

async function getPosts() {
  const query = encodeURIComponent(`*[_type == "post"]{
    title,
    slug,
    content
  }`)

  const url = `https://${client.projectId}.api.sanity.io/v2024-01-01/data/query/${client.dataset}?query=${query}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    console.log(data) // 👈 DEBUG
    return data.result
  } catch (err) {
    console.error("Error:", err)
  }
}
