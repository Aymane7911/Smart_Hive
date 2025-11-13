import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { messages, system } = await request.json();
    
    // Convert messages format and add system message
    const groqMessages = [
      { role: 'system', content: system },
      ...messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }))
    ];
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Updated model
        messages: groqMessages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', error);
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Convert Groq response format to match your expected format
    return NextResponse.json({
      content: [
        {
          type: 'text',
          text: data.choices[0].message.content
        }
      ]
    });
  } catch (error) {
    console.error('AI Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}