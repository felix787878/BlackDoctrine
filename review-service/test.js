// Simple test script for review service
const testReviewService = async () => {
  try {
    // Test getReviews
    const response = await fetch('http://localhost:7004/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query {
            getReviews(productId: "1") {
              id
              productId
              userId
              rating
              comment
              createdAt
            }
          }
        `,
      }),
    });

    const data = await response.json();
    console.log('✅ Review Service Test Results:');
    console.log(JSON.stringify(data, null, 2));

    // Test createReview
    const createResponse = await fetch('http://localhost:7004/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation {
            createReview(input: {
              productId: "1"
              userId: "testuser"
              rating: 5
              comment: "Produk sangat bagus!"
            }) {
              id
              productId
              userId
              rating
              comment
              createdAt
            }
          }
        `,
      }),
    });

    const createData = await createResponse.json();
    console.log('✅ Create Review Test:');
    console.log(JSON.stringify(createData, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

testReviewService();