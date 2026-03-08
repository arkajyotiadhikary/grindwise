export interface TopicData {
  id: string;
  roadmap_id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  day_number: number;
  week_number: number;
  order_index: number;
  content: string;
  key_concepts: string[];
  time_complexity: string;
  space_complexity: string;
}

export const NEETCODE_ROADMAP: TopicData[] = [
  // ─── WEEK 1: Arrays & Hashing ───────────────────────────────────────
  {
    id: 'arrays-basics',
    roadmap_id: 'neetcode',
    name: 'Arrays: Fundamentals',
    description: 'Understanding arrays, indexing, and basic operations',
    category: 'Arrays & Hashing',
    difficulty: 'Beginner',
    day_number: 1,
    week_number: 1,
    order_index: 1,
    content: `## Arrays: The Foundation of DSA

An **array** is a contiguous block of memory storing elements of the same type. It's the most fundamental data structure.

### Key Properties
- **Fixed size** (in most languages): declared at creation
- **O(1) random access**: access any element instantly via index
- **O(n) search**: must scan through elements to find a value
- **0-indexed**: first element is at index 0

### Memory Layout
\`\`\`
Index:  [0]  [1]  [2]  [3]  [4]
Value:  [10] [20] [30] [40] [50]
        ↑
    Base Address (e.g., 1000)
    Element at index i = Base + (i × element_size)
\`\`\`

### Common Operations
| Operation       | Time Complexity |
|----------------|----------------|
| Access         | O(1)           |
| Search         | O(n)           |
| Insert (end)   | O(1) amortized |
| Insert (middle)| O(n)           |
| Delete         | O(n)           |

### Two-Pointer Technique
A classic array pattern — use two indices to solve problems in O(n):
\`\`\`typescript
function twoPointers(arr: number[]): void {
  let left = 0, right = arr.length - 1;
  while (left < right) {
    // process arr[left] and arr[right]
    left++;
    right--;
  }
}
\`\`\``,
    key_concepts: [
      'Indexing',
      'Memory layout',
      'Two-pointer technique',
      'Sliding window',
    ],
    time_complexity: 'Access: O(1), Search: O(n), Insert: O(n)',
    space_complexity: 'O(n)',
  },
  {
    id: 'hashing-basics',
    roadmap_id: 'neetcode',
    name: 'Hash Maps & Sets',
    description: 'Hash tables, collision handling, and common patterns',
    category: 'Arrays & Hashing',
    difficulty: 'Beginner',
    day_number: 2,
    week_number: 1,
    order_index: 2,
    content: `## Hash Maps & Sets

A **hash map** (dictionary) stores key-value pairs with near-instant lookup using a hash function.

### How Hashing Works
\`\`\`
key → hash_function(key) → index → bucket
"apple" → hash("apple") → 3 → store value at index 3
\`\`\`

### TypeScript Usage
\`\`\`typescript
// HashMap
const map = new Map<string, number>();
map.set("apple", 1);
map.get("apple"); // 1
map.has("apple"); // true
map.delete("apple");

// HashSet
const set = new Set<number>();
set.add(1);
set.has(1); // true
set.size;   // 1
\`\`\`

### The Frequency Counter Pattern
Count occurrences to avoid O(n²) nested loops:
\`\`\`typescript
function frequencyCount(arr: number[]): Map<number, number> {
  const freq = new Map<number, number>();
  for (const num of arr) {
    freq.set(num, (freq.get(num) ?? 0) + 1);
  }
  return freq;
}
\`\`\`

### Collision Handling
- **Chaining**: Each bucket holds a linked list
- **Open Addressing**: Find next empty slot (linear probing)`,
    key_concepts: [
      'Hash function',
      'Collision handling',
      'Frequency counter',
      'Complement lookup',
    ],
    time_complexity: 'Average O(1) for get/set/has; O(n) worst case',
    space_complexity: 'O(n)',
  },
  {
    id: 'sliding-window',
    roadmap_id: 'neetcode',
    name: 'Sliding Window',
    description:
      'Efficiently process subarrays/substrings with a moving window',
    category: 'Arrays & Hashing',
    difficulty: 'Intermediate',
    day_number: 3,
    week_number: 1,
    order_index: 3,
    content: `## Sliding Window Technique

The sliding window pattern maintains a **window** over a subset of data, expanding or shrinking it to satisfy a condition — without reprocessing elements.

### Fixed-Size Window
\`\`\`typescript
function maxSumSubarray(arr: number[], k: number): number {
  let windowSum = arr.slice(0, k).reduce((a, b) => a + b, 0);
  let maxSum = windowSum;
  
  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k]; // slide: add new, remove old
    maxSum = Math.max(maxSum, windowSum);
  }
  return maxSum;
}
\`\`\`

### Variable-Size Window
\`\`\`typescript
function longestSubarrayWithSumK(arr: number[], k: number): number {
  let left = 0, sum = 0, maxLen = 0;
  
  for (let right = 0; right < arr.length; right++) {
    sum += arr[right];
    while (sum > k) {
      sum -= arr[left++]; // shrink window
    }
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
}
\`\`\`

### When to Use Sliding Window
- Contiguous subarray/substring problems
- Finding max/min/longest/shortest with a constraint
- Problems with "at most K" or "exactly K" distinct elements`,
    key_concepts: [
      'Fixed window',
      'Variable window',
      'Two pointers',
      'Window invariant',
    ],
    time_complexity: 'O(n) — each element added/removed at most once',
    space_complexity: 'O(1) to O(k) depending on problem',
  },
  {
    id: 'two-pointers',
    roadmap_id: 'neetcode',
    name: 'Two Pointers',
    description: 'Solving array problems with two index pointers',
    category: 'Arrays & Hashing',
    difficulty: 'Beginner',
    day_number: 4,
    week_number: 1,
    order_index: 4,
    content: `## Two Pointers Pattern

Use two pointers moving toward each other (or in the same direction) to reduce O(n²) brute force to O(n).

### Opposite Ends Pattern
\`\`\`typescript
// Check if array is palindrome
function isPalindrome(s: string): boolean {
  let left = 0, right = s.length - 1;
  while (left < right) {
    if (s[left] !== s[right]) return false;
    left++;
    right--;
  }
  return true;
}
\`\`\`

### Same Direction (Fast & Slow)
\`\`\`typescript
// Remove duplicates from sorted array in-place
function removeDuplicates(nums: number[]): number {
  let slow = 0;
  for (let fast = 1; fast < nums.length; fast++) {
    if (nums[fast] !== nums[slow]) {
      nums[++slow] = nums[fast];
    }
  }
  return slow + 1;
}
\`\`\`

### Key Insight
Sorted arrays unlock two-pointer potential — the sorted order lets you make decisions about which pointer to move.`,
    key_concepts: [
      'Opposite ends',
      'Fast & slow pointers',
      'Sorted array tricks',
      'In-place modification',
    ],
    time_complexity: 'O(n)',
    space_complexity: 'O(1)',
  },
  {
    id: 'stack-basics',
    roadmap_id: 'neetcode',
    name: 'Stack',
    description: 'LIFO structure for tracking state and matching problems',
    category: 'Stack',
    difficulty: 'Beginner',
    day_number: 5,
    week_number: 1,
    order_index: 5,
    content: `## Stack: Last In, First Out

A **stack** follows LIFO order — the last element pushed is the first popped. Think of a stack of plates.

### Implementation in TypeScript
\`\`\`typescript
class Stack<T> {
  private data: T[] = [];
  
  push(item: T): void    { this.data.push(item); }
  pop(): T | undefined   { return this.data.pop(); }
  peek(): T | undefined  { return this.data[this.data.length - 1]; }
  isEmpty(): boolean     { return this.data.length === 0; }
  size(): number         { return this.data.length; }
}
\`\`\`

### Monotonic Stack Pattern
Maintains elements in monotonically increasing or decreasing order:
\`\`\`typescript
// Next Greater Element
function nextGreater(nums: number[]): number[] {
  const result = new Array(nums.length).fill(-1);
  const stack: number[] = []; // stores indices
  
  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[i] > nums[stack[stack.length - 1]]) {
      result[stack.pop()!] = nums[i];
    }
    stack.push(i);
  }
  return result;
}
\`\`\`

### Classic Use Cases
- Balanced parentheses matching
- Expression evaluation
- Undo/redo operations
- DFS traversal (iterative)`,
    key_concepts: [
      'LIFO',
      'Monotonic stack',
      'Balanced brackets',
      'Call stack simulation',
    ],
    time_complexity: 'Push/Pop/Peek: O(1)',
    space_complexity: 'O(n)',
  },

  // ─── WEEK 2: Binary Search & Linked Lists ─────────────────────────
  {
    id: 'binary-search',
    roadmap_id: 'neetcode',
    name: 'Binary Search',
    description:
      'Efficiently searching sorted data by halving the search space',
    category: 'Binary Search',
    difficulty: 'Intermediate',
    day_number: 1,
    week_number: 2,
    order_index: 6,
    content: `## Binary Search

Binary search finds a target in a **sorted** array by repeatedly halving the search space, achieving O(log n).

### Classic Template
\`\`\`typescript
function binarySearch(nums: number[], target: number): number {
  let left = 0, right = nums.length - 1;
  
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2); // avoids overflow
    
    if (nums[mid] === target) return mid;
    else if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1; // not found
}
\`\`\`

### Finding Boundaries (Left/Right bisect)
\`\`\`typescript
function leftBound(nums: number[], target: number): number {
  let left = 0, right = nums.length;
  while (left < right) {
    const mid = (left + right) >> 1;
    if (nums[mid] < target) left = mid + 1;
    else right = mid;
  }
  return left;
}
\`\`\`

### Binary Search on Answer
Search the answer space, not the array:
\`\`\`typescript
// Minimum capacity to ship in D days
function shipDays(weights: number[], days: number): number {
  let left = Math.max(...weights);  // min possible capacity
  let right = weights.reduce((a, b) => a + b); // max capacity
  
  while (left < right) {
    const mid = (left + right) >> 1;
    if (canShip(weights, days, mid)) right = mid;
    else left = mid + 1;
  }
  return left;
}
\`\`\``,
    key_concepts: [
      'Search space halving',
      'Left/right bounds',
      'Binary search on answer',
      'Overflow prevention',
    ],
    time_complexity: 'O(log n)',
    space_complexity: 'O(1)',
  },
  {
    id: 'linked-list-basics',
    roadmap_id: 'neetcode',
    name: 'Linked Lists',
    description:
      'Nodes connected by pointers — dynamic size, O(1) insert/delete',
    category: 'Linked List',
    difficulty: 'Beginner',
    day_number: 2,
    week_number: 2,
    order_index: 7,
    content: `## Linked Lists

A **linked list** is a chain of nodes where each node stores data and a pointer to the next node.

### Node Structure
\`\`\`typescript
class ListNode {
  val: number;
  next: ListNode | null;
  constructor(val = 0, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}
\`\`\`

### Core Operations
\`\`\`typescript
// Traverse
function traverse(head: ListNode | null): void {
  let curr = head;
  while (curr) {
    console.log(curr.val);
    curr = curr.next;
  }
}

// Reverse (iterative)
function reverse(head: ListNode | null): ListNode | null {
  let prev: ListNode | null = null;
  let curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}
\`\`\`

### Fast & Slow Pointer (Floyd's Cycle Detection)
\`\`\`typescript
function hasCycle(head: ListNode | null): boolean {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow!.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
\`\`\`

### Arrays vs Linked Lists
| Operation   | Array | Linked List |
|------------|-------|------------|
| Access     | O(1)  | O(n)       |
| Insert/Del | O(n)  | O(1)*      |
| Memory     | Contiguous | Scattered |`,
    key_concepts: [
      'Node pointers',
      'Reversal',
      "Floyd's cycle detection",
      'Dummy node technique',
    ],
    time_complexity: 'Traversal: O(n), Insert/Delete with pointer: O(1)',
    space_complexity: 'O(n)',
  },
  {
    id: 'trees-basics',
    roadmap_id: 'neetcode',
    name: 'Binary Trees & Traversals',
    description: 'Tree structure, DFS (pre/in/post order), and BFS',
    category: 'Trees',
    difficulty: 'Intermediate',
    day_number: 3,
    week_number: 2,
    order_index: 8,
    content: `## Binary Trees

A **binary tree** is a hierarchical structure where each node has at most two children (left and right).

### Node Structure
\`\`\`typescript
class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
  constructor(val = 0, left: TreeNode | null = null, right: TreeNode | null = null) {
    this.val = val; this.left = left; this.right = right;
  }
}
\`\`\`

### DFS Traversals (Recursive)
\`\`\`typescript
// Inorder: Left → Root → Right (gives sorted order for BST)
function inorder(root: TreeNode | null, result: number[] = []): number[] {
  if (!root) return result;
  inorder(root.left, result);
  result.push(root.val);
  inorder(root.right, result);
  return result;
}

// Preorder: Root → Left → Right (useful for tree copying)
function preorder(root: TreeNode | null, result: number[] = []): number[] {
  if (!root) return result;
  result.push(root.val);
  preorder(root.left, result);
  preorder(root.right, result);
  return result;
}
\`\`\`

### BFS (Level Order)
\`\`\`typescript
function levelOrder(root: TreeNode | null): number[][] {
  if (!root) return [];
  const result: number[][] = [];
  const queue: TreeNode[] = [root];
  
  while (queue.length) {
    const level: number[] = [];
    const size = queue.length;
    for (let i = 0; i < size; i++) {
      const node = queue.shift()!;
      level.push(node.val);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    result.push(level);
  }
  return result;
}
\`\`\``,
    key_concepts: [
      'Inorder/Preorder/Postorder',
      'BFS level order',
      'Height/depth',
      'Recursive tree patterns',
    ],
    time_complexity: 'O(n) for all traversals',
    space_complexity: 'O(h) for DFS where h=height, O(n) for BFS',
  },
  {
    id: 'bst',
    roadmap_id: 'neetcode',
    name: 'Binary Search Trees',
    description: 'BST properties, insertion, deletion, and validation',
    category: 'Trees',
    difficulty: 'Intermediate',
    day_number: 4,
    week_number: 2,
    order_index: 9,
    content: `## Binary Search Trees (BST)

A BST maintains the **BST property**: for every node, all values in the left subtree are smaller, and all values in the right subtree are larger.

### BST Property
\`\`\`
       8
      / \\
     3   10
    / \\    \\
   1   6    14
      / \\   /
     4   7 13
\`\`\`
For node 8: left subtree all < 8, right subtree all > 8 ✓

### Search
\`\`\`typescript
function search(root: TreeNode | null, target: number): TreeNode | null {
  if (!root || root.val === target) return root;
  if (target < root.val) return search(root.left, target);
  return search(root.right, target);
}
\`\`\`

### Insert
\`\`\`typescript
function insert(root: TreeNode | null, val: number): TreeNode {
  if (!root) return new TreeNode(val);
  if (val < root.val) root.left = insert(root.left, val);
  else if (val > root.val) root.right = insert(root.right, val);
  return root;
}
\`\`\`

### Validate BST
\`\`\`typescript
function isValidBST(
  node: TreeNode | null,
  min = -Infinity,
  max = Infinity
): boolean {
  if (!node) return true;
  if (node.val <= min || node.val >= max) return false;
  return isValidBST(node.left, min, node.val) &&
         isValidBST(node.right, node.val, max);
}
\`\`\``,
    key_concepts: [
      'BST property',
      'Search O(log n)',
      'Inorder sorted output',
      'BST validation',
    ],
    time_complexity: 'Average O(log n), Worst O(n) for skewed tree',
    space_complexity: 'O(h)',
  },
  {
    id: 'heap-priority-queue',
    roadmap_id: 'neetcode',
    name: 'Heap / Priority Queue',
    description: 'Efficiently get min/max elements with a heap structure',
    category: 'Heap / Priority Queue',
    difficulty: 'Intermediate',
    day_number: 5,
    week_number: 2,
    order_index: 10,
    content: `## Heap / Priority Queue

A **heap** is a complete binary tree satisfying the heap property:
- **Min-heap**: parent ≤ children (root = minimum)
- **Max-heap**: parent ≥ children (root = maximum)

### Key Operations
| Operation   | Time     |
|------------|----------|
| Insert     | O(log n) |
| Get min/max| O(1)     |
| Remove min | O(log n) |
| Build heap | O(n)     |

### Min-Heap Implementation
\`\`\`typescript
class MinHeap {
  private heap: number[] = [];
  
  push(val: number): void {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }
  
  pop(): number | undefined {
    if (!this.heap.length) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return min;
  }
  
  peek(): number { return this.heap[0]; }
  
  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent] <= this.heap[i]) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }
  
  private _sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1, right = 2 * i + 2;
      if (left < n && this.heap[left] < this.heap[smallest]) smallest = left;
      if (right < n && this.heap[right] < this.heap[smallest]) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}
\`\`\`

### Common Patterns
- **K largest/smallest elements**: Use opposite heap of size K
- **Merge K sorted lists**: Min-heap of (val, listIndex)
- **Median of stream**: Two heaps (max-heap left, min-heap right)`,
    key_concepts: [
      'Heap property',
      'Bubble up/Sink down',
      'K-th element pattern',
      'Two-heap median',
    ],
    time_complexity: 'Insert/Delete: O(log n), Peek: O(1)',
    space_complexity: 'O(n)',
  },

  // ─── WEEK 3: Graphs & Dynamic Programming ─────────────────────────
  {
    id: 'graph-basics',
    roadmap_id: 'neetcode',
    name: 'Graphs: BFS & DFS',
    description:
      'Graph representation, BFS for shortest path, DFS for traversal',
    category: 'Graphs',
    difficulty: 'Intermediate',
    day_number: 1,
    week_number: 3,
    order_index: 11,
    content: `## Graphs

A **graph** consists of vertices (nodes) and edges (connections). Unlike trees, graphs can have cycles.

### Representations
\`\`\`typescript
// Adjacency List (most common)
const graph = new Map<number, number[]>();
graph.set(0, [1, 2]);
graph.set(1, [3]);
graph.set(2, [3, 4]);

// Adjacency Matrix (dense graphs)
const matrix: number[][] = Array.from({length: 5}, () => new Array(5).fill(0));
matrix[0][1] = 1; // edge from 0 to 1
\`\`\`

### BFS (Shortest Path in Unweighted Graph)
\`\`\`typescript
function bfs(graph: Map<number, number[]>, start: number): Map<number, number> {
  const distances = new Map<number, number>();
  const queue = [start];
  distances.set(start, 0);
  
  while (queue.length) {
    const node = queue.shift()!;
    for (const neighbor of graph.get(node) ?? []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, distances.get(node)! + 1);
        queue.push(neighbor);
      }
    }
  }
  return distances;
}
\`\`\`

### DFS (Connected Components, Cycle Detection)
\`\`\`typescript
function dfs(
  graph: Map<number, number[]>,
  node: number,
  visited: Set<number>
): void {
  visited.add(node);
  for (const neighbor of graph.get(node) ?? []) {
    if (!visited.has(neighbor)) {
      dfs(graph, neighbor, visited);
    }
  }
}

function countComponents(n: number, edges: number[][]): number {
  const graph = new Map<number, number[]>();
  for (let i = 0; i < n; i++) graph.set(i, []);
  for (const [a, b] of edges) {
    graph.get(a)!.push(b);
    graph.get(b)!.push(a);
  }
  const visited = new Set<number>();
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (!visited.has(i)) { dfs(graph, i, visited); count++; }
  }
  return count;
}
\`\`\``,
    key_concepts: [
      'Adjacency list/matrix',
      'BFS shortest path',
      'DFS connected components',
      'Visited set',
    ],
    time_complexity: 'BFS/DFS: O(V + E)',
    space_complexity: 'O(V + E)',
  },
  {
    id: 'dynamic-programming-1d',
    roadmap_id: 'neetcode',
    name: 'Dynamic Programming: 1D',
    description: 'Memoization and tabulation for overlapping subproblems',
    category: 'Dynamic Programming',
    difficulty: 'Advanced',
    day_number: 2,
    week_number: 3,
    order_index: 12,
    content: `## Dynamic Programming (1D)

DP solves problems by breaking them into **overlapping subproblems** and storing results (memoization/tabulation) to avoid recomputation.

### When to Use DP
1. Problem asks for min/max/count
2. Optimal substructure: optimal solution uses optimal subsolutions
3. Overlapping subproblems: same subproblems solved repeatedly

### Top-Down (Memoization)
\`\`\`typescript
// Fibonacci
function fib(n: number, memo = new Map<number, number>()): number {
  if (n <= 1) return n;
  if (memo.has(n)) return memo.get(n)!;
  const result = fib(n - 1, memo) + fib(n - 2, memo);
  memo.set(n, result);
  return result;
}
\`\`\`

### Bottom-Up (Tabulation)
\`\`\`typescript
// Climbing Stairs (ways to reach step n using 1 or 2 steps)
function climbStairs(n: number): number {
  if (n <= 2) return n;
  const dp = new Array(n + 1).fill(0);
  dp[1] = 1; dp[2] = 2;
  for (let i = 3; i <= n; i++) {
    dp[i] = dp[i - 1] + dp[i - 2];
  }
  return dp[n];
}

// Space optimized (O(1)):
function climbStairsOptimal(n: number): number {
  let [a, b] = [1, 2];
  for (let i = 3; i <= n; i++) [a, b] = [b, a + b];
  return n === 1 ? a : b;
}
\`\`\`

### House Robber Pattern
\`\`\`typescript
function rob(nums: number[]): number {
  let [prev2, prev1] = [0, 0];
  for (const num of nums) {
    [prev2, prev1] = [prev1, Math.max(prev1, prev2 + num)];
  }
  return prev1;
}
\`\`\`

### DP Framework
1. Define the **state** (what does dp[i] represent?)
2. Find the **recurrence relation** (dp[i] = f(dp[i-1], ...))
3. Define **base cases**
4. Determine the **iteration order**`,
    key_concepts: [
      'Memoization',
      'Tabulation',
      'State definition',
      'Recurrence relation',
      'Space optimization',
    ],
    time_complexity: 'O(n) after memoization (vs O(2^n) brute force)',
    space_complexity: 'O(n) tabulation, O(1) space-optimized',
  },
  {
    id: 'dynamic-programming-2d',
    roadmap_id: 'neetcode',
    name: 'Dynamic Programming: 2D',
    description: '2D DP tables for grid and string problems',
    category: 'Dynamic Programming',
    difficulty: 'Advanced',
    day_number: 3,
    week_number: 3,
    order_index: 13,
    content: `## 2D Dynamic Programming

2D DP uses a matrix where dp[i][j] represents the solution for a subproblem involving the first i and j elements.

### Longest Common Subsequence (LCS)
\`\`\`typescript
function longestCommonSubsequence(text1: string, text2: string): number {
  const m = text1.length, n = text2.length;
  const dp: number[][] = Array.from({length: m + 1}, () => new Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (text1[i - 1] === text2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}
\`\`\`

### 0/1 Knapsack
\`\`\`typescript
function knapsack(weights: number[], values: number[], capacity: number): number {
  const n = weights.length;
  const dp: number[][] = Array.from({length: n + 1}, () => new Array(capacity + 1).fill(0));
  
  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w]; // don't take item i
      if (weights[i - 1] <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - weights[i - 1]] + values[i - 1]);
      }
    }
  }
  return dp[n][capacity];
}
\`\`\`

### Unique Paths (Grid DP)
\`\`\`typescript
function uniquePaths(m: number, n: number): number {
  const dp: number[][] = Array.from({length: m}, () => new Array(n).fill(1));
  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
    }
  }
  return dp[m - 1][n - 1];
}
\`\`\``,
    key_concepts: ['LCS', 'Knapsack', 'Grid DP', 'String DP', 'Edit distance'],
    time_complexity: 'O(m × n)',
    space_complexity: 'O(m × n), often reducible to O(n)',
  },
  {
    id: 'backtracking',
    roadmap_id: 'neetcode',
    name: 'Backtracking',
    description:
      'Explore all possibilities systematically, pruning invalid paths',
    category: 'Backtracking',
    difficulty: 'Advanced',
    day_number: 4,
    week_number: 3,
    order_index: 14,
    content: `## Backtracking

Backtracking is a systematic way to explore all possible solutions by building candidates incrementally and **abandoning** (backtracking) when a constraint is violated.

### Template
\`\`\`typescript
function backtrack(
  state: any,
  choices: any[],
  result: any[]
): void {
  if (isComplete(state)) {
    result.push(clone(state));
    return;
  }
  
  for (const choice of choices) {
    if (isValid(state, choice)) {
      makeChoice(state, choice);   // choose
      backtrack(state, choices, result); // explore
      undoChoice(state, choice);   // unchoose (backtrack)
    }
  }
}
\`\`\`

### Permutations
\`\`\`typescript
function permutations(nums: number[]): number[][] {
  const result: number[][] = [];
  
  function backtrack(current: number[], remaining: number[]): void {
    if (!remaining.length) { result.push([...current]); return; }
    for (let i = 0; i < remaining.length; i++) {
      current.push(remaining[i]);
      backtrack(current, [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
      current.pop();
    }
  }
  backtrack([], nums);
  return result;
}
\`\`\`

### Subsets
\`\`\`typescript
function subsets(nums: number[]): number[][] {
  const result: number[][] = [];
  
  function backtrack(start: number, current: number[]): void {
    result.push([...current]);
    for (let i = start; i < nums.length; i++) {
      current.push(nums[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}
\`\`\``,
    key_concepts: [
      'State space tree',
      'Pruning',
      'Choose-explore-unchoose',
      'Permutations/Subsets/Combinations',
    ],
    time_complexity: 'O(n! to 2^n depending on problem)',
    space_complexity: 'O(n) recursion depth',
  },
  {
    id: 'tries',
    roadmap_id: 'neetcode',
    name: 'Tries (Prefix Trees)',
    description: 'Tree structure for efficient string prefix operations',
    category: 'Tries',
    difficulty: 'Intermediate',
    day_number: 5,
    week_number: 3,
    order_index: 15,
    content: `## Tries (Prefix Trees)

A **trie** is a tree where each node represents a character, and paths from root to leaf form words. Perfect for prefix-based string operations.

### Implementation
\`\`\`typescript
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEnd: boolean = false;
}

class Trie {
  root = new TrieNode();
  
  insert(word: string): void {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    node.isEnd = true;
  }
  
  search(word: string): boolean {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) return false;
      node = node.children.get(char)!;
    }
    return node.isEnd;
  }
  
  startsWith(prefix: string): boolean {
    let node = this.root;
    for (const char of prefix) {
      if (!node.children.has(char)) return false;
      node = node.children.get(char)!;
    }
    return true;
  }
  
  // Get all words with given prefix
  autocomplete(prefix: string): string[] {
    let node = this.root;
    for (const char of prefix) {
      if (!node.children.has(char)) return [];
      node = node.children.get(char)!;
    }
    const results: string[] = [];
    this._dfs(node, prefix, results);
    return results;
  }
  
  private _dfs(node: TrieNode, current: string, results: string[]): void {
    if (node.isEnd) results.push(current);
    for (const [char, child] of node.children) {
      this._dfs(child, current + char, results);
    }
  }
}
\`\`\`

### When to Use Tries
- Autocomplete / search suggestions
- Word dictionary problems
- Prefix matching
- Spell checkers`,
    key_concepts: [
      'Prefix storage',
      'Character-by-character insertion',
      'Autocomplete',
      'Word search',
    ],
    time_complexity: 'Insert/Search: O(L) where L = word length',
    space_complexity: 'O(N × L) where N = number of words',
  },
];

export const NEETCODE_PROBLEMS: Record<
  string,
  {
    title: string;
    leetcode_slug: string;
    difficulty: string;
    solution_code: string;
    solution_explanation: string;
    hints: string[];
  }[]
> = {
  'arrays-basics': [
    {
      title: 'Two Sum',
      leetcode_slug: 'two-sum',
      difficulty: 'Easy',
      solution_code: `function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) return [map.get(complement)!, i];
    map.set(nums[i], i);
  }
  return [];
}`,
      solution_explanation:
        'Use a hash map to store each number and its index. For each number, check if its complement (target - num) already exists in the map. This reduces O(n²) brute force to O(n).',
      hints: [
        'What is the complement of nums[i]?',
        'Can you use a hash map to check for complement in O(1)?',
        'Store index alongside value in the map',
      ],
    },
  ],
  'hashing-basics': [
    {
      title: 'Valid Anagram',
      leetcode_slug: 'valid-anagram',
      difficulty: 'Easy',
      solution_code: `function isAnagram(s: string, t: string): boolean {
  if (s.length !== t.length) return false;
  const count = new Map<string, number>();
  for (const c of s) count.set(c, (count.get(c) ?? 0) + 1);
  for (const c of t) {
    if (!count.has(c) || count.get(c) === 0) return false;
    count.set(c, count.get(c)! - 1);
  }
  return true;
}`,
      solution_explanation:
        "Count character frequencies in s using a hash map. Then decrement counts while scanning t. If any count goes to 0 or a character is missing, they're not anagrams.",
      hints: [
        'Two strings are anagrams if they have the same character counts',
        'Use a frequency map for the first string',
        'Decrement frequencies while scanning the second string',
      ],
    },
  ],
  'binary-search': [
    {
      title: 'Binary Search',
      leetcode_slug: 'binary-search',
      difficulty: 'Easy',
      solution_code: `function search(nums: number[], target: number): number {
  let left = 0, right = nums.length - 1;
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}`,
      solution_explanation:
        'Classic binary search. Maintain left and right pointers. Compute mid and compare with target. Adjust the search boundary based on comparison. Use left + (right-left)/2 to prevent integer overflow.',
      hints: [
        'The array is sorted — use this property!',
        'If mid < target, target must be in right half',
        'Prevent overflow: use left + (right-left)/2 instead of (left+right)/2',
      ],
    },
  ],
};
