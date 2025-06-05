import { connectToDatabase, generateTables } from './db/index.js';
import OpenAI from 'openai';
import * as fs from 'fs'
import readLineSync from 'readline-sync';
import { type } from 'os';
const sequelize = await connectToDatabase();

async function main() {
    const sequelize = await connectToDatabase();
    await generateTables(sequelize);

    // Close the connection after generating tables
    await sequelize.close();
}

async function createTodo(title, description) {
    console.log('Creating todo with title:', title, 'and description:', description);
    const Todo = sequelize.models.Todo;
    try {
        const todo = await Todo.create({ title, description });
        console.log('Todo created:', todo.toJSON());
    } catch (error) {
        console.error('Error creating todo:', error);
    }
}

async function getTodos() {
    const Todo = sequelize.models.Todo;
    try {
        const todos = await Todo.findAll();
        console.log('Todos:', todos.map(todo => todo.toJSON()));
        return todos;
    } catch (error) {
        console.error('Error fetching todos:', error);
    }
}

async function updateTodo(id, updates) {
    const Todo = sequelize.models.Todo;
    try {
        const todo = await Todo.findByPk(id);
        if (!todo) {
            console.log('Todo not found');
            return;
        }
        await todo.update(updates);
        console.log('Todo updated:', todo.toJSON());
    } catch (error) {
        console.error('Error updating todo:', error);
    }
}

async function deleteTodo(id) {
    const Todo = sequelize.models.Todo;
    try {
        const todo = await Todo.findByPk(id);
        if (!todo) {
            console.log('Todo not found');
            return;
        }
        await todo.destroy();
        console.log('Todo deleted:', id);
    } catch (error) {
        console.error('Error deleting todo:', error);
    }
}


const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const tools = {
    createTodo: createTodo,
    getTodos: getTodos,
    updateTodo: updateTodo,
    deleteTodo: deleteTodo,
}

const systemPrompt = `You are an AI assistant for a Todo application. Your role is to interpret user requests and convert them into structured commands for CRUD operations (Create, Read, Update, Delete) against a PostgreSQL database. Follow these rules:

AVAILABLE TOOLS:
1. **createTodo(title, description)** - Creates a new todo item
   - title (string): A concise name for the todo item (required)
   - description (string): Detailed information about the task (optional)

2. **getTodos()** - Retrieves all todo items from the database
   - No parameters required

3. **updateTodo(id, updates)** - Updates an existing todo item
   - id (number): The unique identifier of the todo item (required)
   - updates (object): Fields to update, which may include:
     - title (string): New title
     - description (string): New description
     - status (string): e.g., "pending", "in progress", "done"

4. **deleteTodo(id)** - Deletes a todo item
   - id (number): The unique identifier of the todo item (required)

INSTRUCTIONS:
- Always extract the user's intent and map it to the appropriate tool
- Use exact parameter names as specified above
- Convert natural language descriptions of todos into the required parameter format
- For incomplete requests, ask for necessary information before taking action
- Always respond with properly formatted JSON objects
- If a request is ambiguous, ask for clarification instead of guessing
- Validate that IDs for update/delete operations are provided

RESPONSE FORMAT:
For actions: { "type": "action", "action": "[toolName]", "parameters": { ... } }
For clarifications: { "type": "assistant", "text": "[your message asking for more information]" }

EXAMPLES:
- User: "Create a todo for buying groceries"
  AI: { "type": "action", "action": "createTodo", "parameters": { "title": "Buy groceries", "description": "" }, "text": "Todo created successfully." }
- User: "Show me my todos"
  AI: { "type": "action", "action": "getTodos", "parameters": {}, "text": "Here are your todos." }
  `


while (true) {
    // take the input from the user

    const input = readLineSync.question('You: ');
    if (input.toLowerCase() === 'exit') {
        console.log('Exiting the application.');
        break;
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input }
    ]
    console.log(messages)


    const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        tools: Object.keys(tools).map(toolName => ({
            type: 'function',
            function: {
                name: toolName,
                description: `Function to ${toolName}`,
                parameters: {
                    type: 'object',
                    properties: {}
                }
            }
        })),
        response_format : {
            type : 'json_object'
        },
        tool_choice: 'auto'
    });

    const message = response.choices[0].message;
    const result = JSON.parse(message.content);
    console.log(`AI: ${message.content}`);
    messages.push({ role: 'user', content: input });
    messages.push({ role: 'assistant', content: result.text });
    
    if(result.type === 'action') {
        const toolName = result.action;
        const parameters = result.parameters;

        if (tools[toolName]) {
            try {
                console.log(`Executing tool: ${toolName} with parameters:`, parameters);
                await tools[toolName](...Object.values(parameters));
                console.log(`AI : ${result.text}`);
            } catch (error) {
                console.error(`Error executing ${toolName}:`, error);
            }
        } else {
            console.error(`Tool ${toolName} not found.`);
        }
    } else if (message.content.type === 'assistant') {
        console.log(`AI: ${result.text}`);
    }



}