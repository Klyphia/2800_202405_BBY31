document.getElementById('signupForm').addEventListener('submit', async function(event) {
    event.preventDefault();
  
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
  
    const response = await fetch('/submitSignUp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
  
    const result = await response.json();
  
    if (response.ok) {
      window.location.href = '/profile';
    } else {
      const errorMessagesDiv = document.getElementById('errorMessages');
      errorMessagesDiv.innerHTML = '';
      result.error.forEach(error => {
        const errorMessage = document.createElement('p');
        errorMessage.textContent = error;
        errorMessagesDiv.appendChild(errorMessage);
      });
    }
  });
  