// ✅ Check if script loaded
console.log("Sanity script loaded")

const client = {
  projectId: "ncyeom8c",
  dataset: "production"
}

// ✅ Fetch posts from Sanity
async function getPosts() {
  const query = encodeURIComponent('*[_type == "post"]{title, slug, content}')
  const url = `https://${client.projectId}.api.sanity.io/v2024-01-01/data/query/${client.dataset}?query=${query}`

  try {
    const res = await fetch(url)
    const data = await res.json()

    console.log("Fetched Data:", data.result) // 🔍 debug
    return data.result

  } catch (error) {
    console.error("Fetch Error:", error)
    return []
  }
}

// ✅ Render posts on page
getPosts().then(posts => {
  const container = document.getElementById("blog-container")

  // ❌ agar container nahi mila
  if (!container) {
    console.error("blog-container not found ❌")
    return
  }

  // ❌ agar koi post nahi hai
  if (!posts || posts.length === 0) {
    container.innerHTML = "<p>No posts found 😢</p>"
    return
  }

  // ✅ render posts
  posts.forEach(post => {
    const div = document.createElement("div")

    div.innerHTML = `
      <h2>${post.title || "No Title"}</h2>
      <p>${post.content || "No Content"}</p>
      <hr/>
    `

    container.appendChild(div)
  })
})
