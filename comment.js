// client side form parsing

$(document).ready(function() {
    // #commentForm is the textbox id for the comment/input box
    $('#commentForm').submit(function(event) {
      event.preventDefault(); // Prevent default form submission
  
      // Get the comment data from the form
      const postId = $('#postId').val();
      const comment = $('#commentText').val();
  
      // Send an AJAX request to the server to submit the comment
      $.ajax({
        url: '/post/comment', // routing to /post/comment in index.js
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ postId: postId, comment: comment }),
        success: function(response) {
          // Handle success response from the server
          console.log(response.message);
          // Optionally, display a success message to the user
        },
        error: function(xhr, status, error) {
          // Handle error response from the server
          console.error(error);
          // Optionally, display an error message to the user
        }
      });
    });
  });
  