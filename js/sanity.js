const client = {
  projectId: "ncyeom8c",
  dataset: "production"
}

async function getPosts() {
  const query = encodeURIComponent('*[_type == "post"]{title, content}')
  const url = `https://${client.projectId}.api.sanity.io/v2024-01-01/data/query/${client.dataset}?query=${query}`

  const res = await fetch(url)
  const data = await res.json()
  return data.result
}

getPosts().then(posts => {
  console.log("POSTS:", posts)

  const container = document.getElementById("blog-container")

  if (!posts.length) {
    container.innerHTML = "<p>No posts found 😢</p>"
    return
  }

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
