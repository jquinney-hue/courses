// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Configuration (Using the secondary config as it includes authDomain)
const firebaseConfig = {
    apiKey: "AIzaSyCIZpaHCz9vRemyqjEAhGt0v1A5C4eqZVc",
    authDomain: "test-d4c00.firebaseapp.com",
    databaseURL: "https://test-d4c00-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "test-d4c00",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Google Auth Provider setup (Forces specific domain)
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
    hd: 'jhncc.org' // Restricts Google login to this specific domain
});

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');
const userDisplay = document.getElementById('user-display');
const yearSelect = document.getElementById('year-group-select');
const courseListContainer = document.getElementById('course-list-container');
const lessonContainer = document.getElementById('lesson-container');
const injectedLessonContent = document.getElementById('injected-lesson-content');
const backToCoursesBtn = document.getElementById('back-to-courses-btn');

let currentUser = null;

// --- AUTHENTICATION ---

loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => {
        loginError.innerText = error.message;
    });
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Double-check email domain just in case
        if (!user.email.endsWith('@jhncc.org')) {
            signOut(auth);
            loginError.innerText = "Access denied. You must use a @jhncc.org email address.";
            return;
        }
        currentUser = user;
        loginScreen.classList.remove('active');
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        appScreen.classList.add('active');
        userDisplay.innerText = user.email;
    } else {
        currentUser = null;
        appScreen.classList.remove('active');
        appScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        loginScreen.classList.add('active');
        // Reset UI
        courseListContainer.innerHTML = '<h3>Select a year group to view available courses.</h3>';
        lessonContainer.classList.add('hidden');
        yearSelect.value = "";
    }
});

// --- CONTENT LOADING ---

// 1. Load available courses for the selected year
yearSelect.addEventListener('change', async (e) => {
    const year = e.target.value;
    lessonContainer.classList.add('hidden');
    courseListContainer.classList.remove('hidden');
    courseListContainer.innerHTML = 'Loading courses...';

    try {
        // Since GitHub Pages is static, you need an index file mapping years to courses
        const response = await fetch('courses/course_index.json'); 
        const allCourses = await response.json();
        const yearCourses = allCourses[`year_${year}`] || [];

        courseListContainer.innerHTML = `<h2>Year ${year} Courses</h2>`;
        
        if (yearCourses.length === 0) {
            courseListContainer.innerHTML += '<p>No courses available for this year group.</p>';
            return;
        }

        yearCourses.forEach(course => {
            const btn = document.createElement('button');
            btn.innerText = course.name;
            btn.className = 'course-btn';
            btn.onclick = () => loadLesson(course.folder, 'lesson1'); // Defaults to lesson1
            courseListContainer.appendChild(btn);
        });

    } catch (error) {
        courseListContainer.innerHTML = `<p class="error">Error loading courses: ${error.message}</p>`;
    }
});

// 2. Load the specific JSON lesson
async function loadLesson(courseFolder, lessonFile) {
    try {
        const response = await fetch(`courses/${courseFolder}/${lessonFile}.json`);
        const data = await response.json();

        // Hide course list, show lesson container
        courseListContainer.classList.add('hidden');
        lessonContainer.classList.remove('hidden');

        // Inject HTML
        injectedLessonContent.innerHTML = data.html_content;

        // Inject CSS safely
        const styleId = `style-${data.course_code}`;
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = data.css_content;
            document.head.appendChild(style);
        }

        // Inject JS safely (Creating a new script tag ensures it executes)
        const scriptId = `script-${data.course_code}`;
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.innerHTML = data.js_content;
            document.body.appendChild(script);
        }

        // Track performance/interaction in Firebase
        trackPerformance(data.course_name, data.course_code, lessonFile);

    } catch (error) {
        console.error("Error loading lesson:", error);
        alert("Failed to load the lesson. Ensure the JSON file exists.");
    }
}

backToCoursesBtn.addEventListener('click', () => {
    lessonContainer.classList.add('hidden');
    courseListContainer.classList.remove('hidden');
    injectedLessonContent.innerHTML = ''; // Clear content
});

// --- PERFORMANCE TRACKING ---

function trackPerformance(courseName, courseCode, lessonId) {
    if (!currentUser) return;

    // Use a highly specific nested path to avoid cluttering the rest of the database
    const trackingRef = ref(db, `jhncc_edu_platform_metrics/user_engagements/${currentUser.uid}`);
    
    push(trackingRef, {
        email: currentUser.email,
        course_name: courseName,
        course_code: courseCode,
        lesson_accessed: lessonId,
        timestamp: serverTimestamp()
    }).catch(err => console.error("Tracking error:", err));
}
