const client = {
  projectId: "ncyeom8c",
  dataset: "production"
}

async function getPosts() {
  const query = encodeURIComponent('*[_type == "post"]{title, slug, content}')
  const url = `https://${client.projectId}.api.sanity.io/v2024-01-01/data/query/${client.dataset}?query=${query}`

  const res = await fetch(url)
  const data = await res.json()
  return data.result
}

// 👇 YE FUNCTION KE BAHAR AAYEGA
getPosts().then(posts => {
  const container = document.getElementById("blog-container")

  posts.forEach(post => {
    const div = document.createElement("div")
    div.innerHTML = `
      <h2>${post.title}</h2>
      <p>${post.content}</p>
      <hr/>
    `
    container.appendChild(div)
  })
})
