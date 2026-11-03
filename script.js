
/* =====================================
   MY FAMILY HERITAGE - COMPLETE JAVASCRIPT
===================================== */

const STORAGE_KEY = "myFamilyHeritageMembers";

let members = loadMembers();

// =====================================
// 1. LOAD AND SAVE FAMILY DATA
// =====================================

function loadMembers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Could not load family data:", error);
    return [];
  }
}

function saveMembers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

// =====================================
// 2. HELPER FUNCTIONS
// =====================================

function createId() {
  return Date.now().toString(36) +
    Math.random().toString(36).substring(2, 9);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

function getFullName(member) {
  return [member.firstName, member.lastName]
    .filter(Boolean)
    .join(" ");
}

function getMember(id) {
  if (!id) return null;
  return members.find(member => member.id === id) || null;
}

function formatDate(date) {
  if (!date) return "Not provided";

  const parsed = new Date(date + "T00:00:00");

  if (Number.isNaN(parsed.getTime())) {
    return "Not provided";
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function isLiving(member) {
  return !member.deathDate;
}

// =====================================
// 3. NAVIGATION
// =====================================

const pageTitles = {
  dashboard: "Dashboard",
  members: "Family Members",
  tree: "Family Tree",
  timeline: "Family Timeline",
  settings: "Settings"
};

function showPage(pageName) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.remove("active");
  });

  const page = document.getElementById(pageName + "-page");

  if (!page) return;

  page.classList.add("active");

  const navButton = document.querySelector(
    `.nav-link[data-page="${pageName}"]`
  );

  if (navButton) {
    navButton.classList.add("active");
  }

  document.getElementById("page-title").textContent =
    pageTitles[pageName] || "Family Heritage";

  if (pageName === "tree") renderFamilyTree();
  if (pageName === "timeline") renderTimeline();
  if (pageName === "dashboard") renderDashboard();
  if (pageName === "members") renderMembers();
}

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.go);
  });
});

// Settings navigation
const settingsButton = document.createElement("button");

settingsButton.className = "nav-link";
settingsButton.dataset.page = "settings";
settingsButton.innerHTML = "<span>⚙️</span> Settings";

const navigation = document.querySelector(".navigation");

if (navigation) {
  navigation.appendChild(settingsButton);
}

settingsButton.addEventListener("click", () => {
  showPage("settings");
});

// Quick add button
document.getElementById("quick-add-button")
  .addEventListener("click", () => {
    showPage("members");
    clearForm();

    updateRelationshipOptions();

    document.getElementById("first-name").focus();
  });

// =====================================
// 4. FAMILY MEMBER FORM
// =====================================

const memberForm = document.getElementById("member-form");

function clearForm() {
  memberForm.reset();

  document.getElementById("member-id").value = "";

  document.getElementById("save-member-button").textContent =
    "Save Family Member";

  updateRelationshipOptions();
}

document.getElementById("cancel-edit-button")
  .addEventListener("click", clearForm);

memberForm.addEventListener("submit", function(event) {
  event.preventDefault();

  const id = document.getElementById("member-id").value;

  const firstName = document.getElementById("first-name")
    .value.trim();

  if (!firstName) {
    alert("Please enter the family member's first name.");
    return;
  }

  const fatherId = document.getElementById("father-id").value;
  const motherId = document.getElementById("mother-id").value;
  const spouseId = document.getElementById("spouse-id").value;

  if (
    id &&
    (fatherId === id || motherId === id || spouseId === id)
  ) {
    alert("You cannot select yourself as your own parent or spouse.");
    return;
  }

  if (fatherId && fatherId === motherId) {
    alert("Please select different people for father and mother.");
    return;
  }

  const existing = id ? getMember(id) : null;

  const member = {
    id: id || createId(),

    firstName,

    lastName: document.getElementById("last-name").value.trim(),

    gender: document.getElementById("gender").value,

    birthDate: document.getElementById("birth-date").value,

    deathDate: document.getElementById("death-date").value,

    fatherId,
    motherId,
    spouseId,

    birthPlace: document.getElementById("birth-place").value.trim(),

    biography: document.getElementById("biography").value.trim(),

    createdAt: existing
      ? existing.createdAt
      : new Date().toISOString()
  };

  // Check circular parent relationships
  if (wouldCreateAncestorCycle(member)) {
    alert("This parent selection would create an invalid family relationship.");
    return;
  }

  // Check spouse relationship
  if (spouseId) {
    const spouse = getMember(spouseId);

    if (spouse && spouse.spouseId &&
        spouse.spouseId !== member.id) {
      alert("This person is already connected to another spouse.");
      return;
    }
  }

  // Save the member
  if (existing) {
    Object.assign(existing, member);
  } else {
    members.push(member);
  }

  // Remove the previous spouse connection if it changed
  const previousSpouse = existing
    ? getMember(existing.spouseId)
    : null;

  if (
    previousSpouse &&
    previousSpouse.id !== spouseId &&
    previousSpouse.spouseId === member.id
  ) {
    previousSpouse.spouseId = "";
  }

  // Connect new spouse in both directions
  if (spouseId) {
    const spouse = getMember(spouseId);

    if (spouse) {
      spouse.spouseId = member.id;
    }
  }

  saveMembers();

  clearForm();

  refreshAll();

  alert(existing
    ? "Family member updated!"
    : "Family member added!"
  );
});

// =====================================
// 5. VALIDATE PARENT RELATIONSHIPS
// =====================================

function wouldCreateAncestorCycle(candidate) {
  const parents = [
    candidate.fatherId,
    candidate.motherId
  ].filter(Boolean);

  function hasAncestor(id, targetId, visited = new Set()) {
    if (!id) return false;

    if (id === targetId) return true;

    if (visited.has(id)) return false;

    visited.add(id);

    const person = getMember(id);

    if (!person) return false;

    return (
      hasAncestor(person.fatherId, targetId, visited) ||
      hasAncestor(person.motherId, targetId, visited)
    );
  }

  return parents.some(parentId =>
    hasAncestor(parentId, candidate.id)
  );
}

// =====================================
// 6. PARENT AND SPOUSE SELECTORS
// =====================================

function updateRelationshipOptions() {
  const fields = [
    "father-id",
    "mother-id",
    "spouse-id"
  ];

  const currentId = document.getElementById("member-id").value;

  fields.forEach(fieldId => {
    const select = document.getElementById(fieldId);

    const previousValue = select.value;

    const labels = {
      "father-id": "Select father",
      "mother-id": "Select mother",
      "spouse-id": "Select spouse"
    };

    select.innerHTML = "";

    const firstOption = document.createElement("option");

    firstOption.value = "";
    firstOption.textContent = labels[fieldId];

    select.appendChild(firstOption);

    members.forEach(member => {
      if (member.id === currentId) return;

      const option = document.createElement("option");

      option.value = member.id;
      option.textContent = getFullName(member);

      select.appendChild(option);
    });

    if ([...select.options].some(option =>
      option.value === previousValue
    )) {
      select.value = previousValue;
    }
  });
}

// =====================================
// 7. DISPLAY FAMILY MEMBERS
// =====================================

function renderMembers(searchTerm = "") {
  const container = document.getElementById("members-list");

  const filtered = members.filter(member => {
    const name = getFullName(member).toLowerCase();

    return name.includes(searchTerm.toLowerCase());
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div>👨‍👩‍👧‍👦</div>
        <h3>No family members found</h3>
        <p>Add a family member or try another search.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(member => {
    const status = isLiving(member) ? "Living" : "Deceased";

    const avatar = member.gender === "Female" ? "👩" :
      member.gender === "Male" ? "👨" : "👤";

    return `
      <article class="member-card">

        <div class="member-avatar">${avatar}</div>

        <h3>${escapeHTML(getFullName(member))}</h3>

        <p>${escapeHTML(member.gender || "Gender not specified")}</p>

        <p>Born: ${escapeHTML(formatDate(member.birthDate))}</p>

        <p>${escapeHTML(member.birthPlace || "Place not provided")}</p>

        <span class="member-status ${isLiving(member) ? "" : "deceased"}">
          ${status}
        </span>

        <div class="member-actions">

          <button data-edit="${escapeHTML(member.id)}">
            Edit
          </button>

          <button class="delete-button"
            data-delete="${escapeHTML(member.id)}">
            Delete
          </button>

        </div>

      </article>
    `;
  }).join("");
}

// Search members
document.getElementById("member-search")
  .addEventListener("input", event => {
    renderMembers(event.target.value);
  });

// Edit and delete buttons
document.getElementById("members-list")
  .addEventListener("click", event => {

    const editButton = event.target.closest("[data-edit]");

    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) {
      editMember(editButton.dataset.edit);
    }

    if (deleteButton) {
      deleteMember(deleteButton.dataset.delete);
    }
  });

// =====================================
// 8. EDIT FAMILY MEMBER
// =====================================

function editMember(id) {
  const member = getMember(id);

  if (!member) return;

  showPage("members");

  // Set the member ID before creating relationship options
  document.getElementById("member-id").value = member.id;

  updateRelationshipOptions();

  document.getElementById("first-name").value =
    member.firstName || "";

  document.getElementById("last-name").value =
    member.lastName || "";

  document.getElementById("gender").value =
    member.gender || "";

  document.getElementById("birth-date").value =
    member.birthDate || "";

  document.getElementById("death-date").value =
    member.deathDate || "";

  document.getElementById("father-id").value =
    member.fatherId || "";

  document.getElementById("mother-id").value =
    member.motherId || "";

  document.getElementById("spouse-id").value =
    member.spouseId || "";

  document.getElementById("birth-place").value =
    member.birthPlace || "";

  document.getElementById("biography").value =
    member.biography || "";

  document.getElementById("save-member-button").textContent =
    "Update Family Member";

  document.getElementById("first-name").focus();
}

// =====================================
// 9. DELETE FAMILY MEMBER
// =====================================

function deleteMember(id) {
  const member = getMember(id);

  if (!member) return;

  const confirmed = confirm(
    "Are you sure you want to delete " +
    getFullName(member) + "?"
  );

  if (!confirmed) return;

  members = members
    .filter(person => person.id !== id)
    .map(person => ({
      ...person,

      fatherId: person.fatherId === id
        ? ""
        : person.fatherId,

      motherId: person.motherId === id
        ? ""
        : person.motherId,

      spouseId: person.spouseId === id
        ? ""
        : person.spouseId
    }));

  saveMembers();

  refreshAll();
}

// =====================================
// 10. DASHBOARD
// =====================================

function calculateGenerations() {
  const cache = new Map();

  function generationOf(member, visited = new Set()) {
    if (cache.has(member.id)) {
      return cache.get(member.id);
    }

    if (visited.has(member.id)) {
      return 1;
    }

    const nextVisited = new Set(visited);

    nextVisited.add(member.id);

    const parents = [
      member.fatherId,
      member.motherId
    ]
      .map(getMember)
      .filter(Boolean);

    if (parents.length === 0) {
      cache.set(member.id, 1);
      return 1;
    }

    const result = 1 + Math.max(
      ...parents.map(parent =>
        generationOf(parent, nextVisited)
      )
    );

    cache.set(member.id, result);

    return result;
  }

  if (members.length === 0) return 0;

  return Math.max(
    ...members.map(member => generationOf(member))
  );
}

function renderDashboard() {
  document.getElementById("total-members").textContent =
    members.length;

  document.getElementById("total-generations").textContent =
    calculateGenerations();

  document.getElementById("living-members").textContent =
    members.filter(isLiving).length;

  document.getElementById("deceased-members").textContent =
    members.filter(member => !isLiving(member)).length;

  const recent = [...members]
    .sort((a, b) =>
      new Date(b.createdAt || 0) -
      new Date(a.createdAt || 0)
    )
    .slice(0, 5);

  const container = document.getElementById("recent-members");

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div>👨‍👩‍👧‍👦</div>
        <h3>Your family story starts here</h3>
        <p>Add your first family member to begin building your family tree.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = recent.map(member => `
    <div class="recent-member">
      <strong>${escapeHTML(getFullName(member))}</strong>
      <span>${escapeHTML(member.gender || "Family member")}</span>
    </div>
  `).join("");
}

// =====================================
// 11. COMPLETE FAMILY TREE
// =====================================

function renderFamilyTree() {
  const container = document.getElementById("family-tree");

  if (!members.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div>🌳</div>
        <h3>Your family tree is waiting</h3>
        <p>Add family members and connect their parents.</p>
      </div>
    `;
    return;
  }

  const displayed = new Set();

  function avatar(member) {
    return member.gender === "Female" ? "👩" :
      member.gender === "Male" ? "👨" : "👤";
  }

  function memberCard(member, relationship = "") {
    return `
      <div class="tree-member">

        <div class="tree-avatar">
          ${avatar(member)}
        </div>

        <strong>${escapeHTML(getFullName(member))}</strong>

        ${relationship
          ? `<span>${escapeHTML(relationship)}</span>`
          : ""
        }

        <span>${escapeHTML(member.birthPlace || "")}</span>

      </div>
    `;
  }

  // Find children of one or two parents
  function getChildren(parentIds) {
    return members.filter(member =>
      (
        parentIds.includes(member.fatherId) ||
        parentIds.includes(member.motherId)
      ) &&
      !displayed.has(member.id)
    );
  }

  // Render descendants recursively
  function renderBranch(parentIds, visited = new Set()) {
    const children = getChildren(parentIds);

    if (!children.length) return "";

    return `
      <div class="family-line"></div>

      <div class="children-horizontal">

        ${children.map(child => {

          if (visited.has(child.id)) {
            return "";
          }

          const nextVisited = new Set(visited);

          nextVisited.add(child.id);

          displayed.add(child.id);

          // Find this child's spouse
          const spouse = getMember(child.spouseId);

          let couple = [child];

          if (
            spouse &&
            !displayed.has(spouse.id) &&
            !nextVisited.has(spouse.id)
          ) {
            couple.push(spouse);
            displayed.add(spouse.id);
          }

          // Include both partners when finding grandchildren
          const nextParentIds = couple.map(person => person.id);

          return `
            <div class="child-branch">

              <div class="family-couple">

                ${couple.map(person =>
                  memberCard(
                    person,
                    person.id === child.id ? "Child" : "Spouse"
                  )
                ).join("")}

              </div>

              ${renderBranch(nextParentIds, nextVisited)}

            </div>
          `;

        }).join("")}

      </div>
    `;
  }

  // Find oldest generation
  const roots = members.filter(member =>
    !getMember(member.fatherId) &&
    !getMember(member.motherId)
  );

  if (!roots.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No starting generation found</h3>
        <p>Please check the parent relationships.</p>
      </div>
    `;
    return;
  }

  // Render each oldest-generation couple
  function renderRoot(member) {
    if (displayed.has(member.id)) return "";

    const spouse = getMember(member.spouseId);

    const couple = [member];

    if (
      spouse &&
      !displayed.has(spouse.id) &&
      !getMember(spouse.fatherId) &&
      !getMember(spouse.motherId)
    ) {
      couple.push(spouse);
    }

    couple.forEach(person => displayed.add(person.id));

    const parentIds = couple.map(person => person.id);

    return `
      <div class="family-branch">

        <div class="family-couple">

          ${couple.map(person =>
            memberCard(
              person,
              person.id === member.id ? "Family elder" : "Spouse"
            )
          ).join("")}

        </div>

        ${renderBranch(parentIds, new Set(parentIds))}

      </div>
    `;
  }

  container.innerHTML = `
    <div class="family-tree-graph">

      ${roots.map(renderRoot).join("")}

    </div>
  `;

  // Report people who could not be connected to the tree
  const unconnected = members.filter(member =>
    !displayed.has(member.id)
  );

  if (unconnected.length) {
    container.innerHTML += `
      <div class="unconnected-family">

        <h3>Other Family Members</h3>

        <p>These members are not connected to the displayed family branches yet.</p>

        <div class="family-couple">

          ${unconnected.map(member =>
            memberCard(member, "Not connected")
          ).join("")}

        </div>

      </div>
    `;
  }
}

// =====================================
// 12. FAMILY TIMELINE
// =====================================

function renderTimeline() {
  const container = document.getElementById("family-timeline");

  const events = [];

  members.forEach(member => {

    if (member.birthDate) {
      events.push({
        date: member.birthDate,
        title: getFullName(member) + " was born",
        detail: member.birthPlace || "Birthplace not provided"
      });
    }

    if (member.deathDate) {
      events.push({
        date: member.deathDate,
        title: "Remembering " + getFullName(member),
        detail: "Date of death"
      });
    }

  });

  events.sort((a, b) => a.date.localeCompare(b.date));

  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div>📅</div>
        <h3>No family dates yet</h3>
        <p>Add dates of birth to start your family timeline.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map(event => `
    <div class="timeline-item">

      <strong>${escapeHTML(formatDate(event.date))}</strong>

      <p>${escapeHTML(event.title)}</p>

      <p>${escapeHTML(event.detail)}</p>

    </div>
  `).join("");
}

// =====================================
// 13. EXPORT FAMILY DATA
// =====================================

document.getElementById("export-button")
  .addEventListener("click", () => {

    const backup = {
      application: "My Family Heritage",
      exportedAt: new Date().toISOString(),
      members
    };

    const file = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(file);

    const link = document.createElement("a");

    link.href = url;
    link.download = "my-family-heritage-backup.json";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  });

// =====================================
// 14. IMPORT FAMILY DATA
// =====================================

document.getElementById("import-file")
  .addEventListener("change", async event => {

    const file = event.target.files[0];

    if (!file) return;

    try {
      const fileText = await file.text();

      const backup = JSON.parse(fileText);

      if (!backup || !Array.isArray(backup.members)) {
        throw new Error("Invalid backup file");
      }

      const validMembers = backup.members.every(member =>
        member &&
        typeof member.id === "string" &&
        typeof member.firstName === "string"
      );

      if (!validMembers) {
        throw new Error("Invalid member information");
      }

      const confirmed = confirm(
        "Importing will replace your current family information. Continue?"
      );

      if (!confirmed) return;

      members = backup.members;

      saveMembers();

      refreshAll();

      alert("Family information imported successfully!");

    } catch (error) {
      alert(
        "Could not import this file. Please select a valid family backup."
      );

      console.error(error);

    } finally {
      event.target.value = "";
    }
  });

// =====================================
// 15. REFRESH WEBSITE
// =====================================

function refreshAll() {
  updateRelationshipOptions();

  renderDashboard();

  renderMembers(
    document.getElementById("member-search").value
  );

  renderFamilyTree();

  renderTimeline();
}

// =====================================
// 16. INITIALIZE WEBSITE
// =====================================

document.getElementById("current-year").textContent =
  new Date().getFullYear();

updateRelationshipOptions();

refreshAll();

showPage("dashboard");
