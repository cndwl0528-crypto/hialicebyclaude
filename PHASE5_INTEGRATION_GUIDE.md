# HiAlice Phase 5: Integration Guide for Developers

**Purpose**: Quick reference for integrating Phase 5 components into your workflow
**Version**: 1.0
**Last Updated**: March 9, 2026

---

## Quick Start

### 1. ErrorBoundary Setup (5 minutes)

ErrorBoundary is already integrated in `layout.js`, but here's how to use it elsewhere:

```javascript
// Import the component
import ErrorBoundary from '@/components/ErrorBoundary';

// Wrap your component
export default function YourPage() {
  return (
    <ErrorBoundary>
      <YourContent />
    </ErrorBoundary>
  );
}
```

**Key Points**:
- Catches render errors only (not event handlers)
- For event handler errors, use try-catch instead
- Works with dynamic imports: `React.lazy()`
- Shows dev error details in development mode

```javascript
// Example with lazy loading
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

export default function App() {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<div>Loading...</div>}>
        <HeavyComponent />
      </React.Suspense>
    </ErrorBoundary>
  );
}
```

---

### 2. Loading Skeletons (5 minutes)

Use when fetching data:

```javascript
import { SkeletonCard, PageLoader, SkeletonGrid } from '@/components/LoadingSkeleton';

export default function BooksPage() {
  const [books, setBooks] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooks().then(data => {
      setBooks(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <SkeletonGrid count={4} />;
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {books.map(book => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
```

**Available Skeletons**:
- `SkeletonCard` — Single card placeholder
- `SkeletonText` — Text lines (configurable)
- `SkeletonAvatar` — Profile pictures (sm/md/lg/xl)
- `SkeletonChat` — Chat message (alice/student)
- `PageLoader` — Full page loading
- `SkeletonGrid` — Grid of cards

```javascript
// Examples with different configurations
<SkeletonText lines={5} />
<SkeletonAvatar size="lg" />
<SkeletonChat variant="student" />
<PageLoader message="Loading your books..." />
```

---

### 3. Offline Banner (Already Active)

The OfflineBanner is automatically shown in layout.js when offline:

```javascript
// In layout.js - already implemented:
import OfflineBanner from '@/components/OfflineBanner';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary>
          <OfflineBanner />  {/* Automatically shows/hides */}
          {/* Rest of app */}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

**Features**:
- No prop configuration needed
- Automatically detects offline/online
- Shows only when offline
- No hydration issues

---

### 4. Service Worker & PWA (Already Active)

Service worker automatically installed via `layout.js`:

```javascript
// In layout.js - already implemented:
useEffect(() => {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
}, []);
```

**To use offline features**:
1. Load a page (SW caches it)
2. Go offline (DevTools → Network → Offline)
3. Reload page
4. Content should still be visible

**Caching Strategy**:
- **API calls** (`/api/*`): Network-first
- **Images/CSS/JS**: Cache-first
- **HTML pages**: Network-first with offline fallback

---

### 5. Environment Configuration

Copy and configure the template:

```bash
# Copy template
cp .env.example .env.local

# Edit with your values
nano .env.local
```

**Required for production**:
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-actual-key
SUPABASE_SERVICE_KEY=your-actual-key

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# Database (if using Docker)
DB_USER=hialice
DB_PASSWORD=secure-password
```

**Optional for speech/AI**:
```env
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
```

---

## Common Patterns

### Pattern 1: Page with Loading State

```javascript
import { PageLoader } from '@/components/LoadingSkeleton';

export default function MyPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  if (!data) {
    return <PageLoader message="Loading your books..." />;
  }

  return <div>{/* Your content */}</div>;
}
```

### Pattern 2: List with Skeleton

```javascript
import { SkeletonGrid } from '@/components/LoadingSkeleton';

export default function BooksList() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooks();
  }, []);

  return (
    <div>
      {loading ? (
        <SkeletonGrid count={6} />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {books.map(book => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Pattern 3: Chat with Skeleton

```javascript
import { SkeletonChat } from '@/components/LoadingSkeleton';

export default function ChatSession() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (message) => {
    setMessages([...messages, { text: message, sender: 'student' }]);
    setLoading(true);

    const response = await getAIResponse(message);
    setMessages(prev => [...prev, { text: response, sender: 'alice' }]);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {messages.map((msg, i) => (
        <ChatBubble key={i} message={msg} />
      ))}
      {loading && <SkeletonChat variant="alice" />}
    </div>
  );
}
```

### Pattern 4: Error Handling

```javascript
import ErrorBoundary from '@/components/ErrorBoundary';

export default function Page() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

---

## Testing & Debugging

### Test Offline Mode

1. **In DevTools**:
   - Open Chrome DevTools (F12)
   - Go to Application tab → Service Workers
   - Check "Offline" box
   - Page should still work (cached content)

2. **Test offline page**:
   - Go offline (DevTools → Network → Offline)
   - Navigate to `/offline`
   - Should see offline page

3. **Check service worker**:
   ```javascript
   // In browser console:
   navigator.serviceWorker.getRegistrations().then(regs => {
     console.log(regs);
   });
   ```

### Test Error Boundary

Throw an error in development:

```javascript
import ErrorBoundary from '@/components/ErrorBoundary';

function BuggyComponent() {
  throw new Error('Test error');
}

export default function TestPage() {
  return (
    <ErrorBoundary>
      <BuggyComponent />
    </ErrorBoundary>
  );
}
```

Should see error page with "Try Again" button.

### Monitor Console Errors

Service worker logs to console:
```javascript
// Check for SW messages:
// [ServiceWorker] Installing...
// [ServiceWorker] Caching static assets
// [ServiceWorker] Activating...
```

---

## Docker Deployment

### Local Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f hialice-app

# Stop services
docker-compose down
```

### Production Build

```bash
# Build image
docker build -t hialice:latest .

# Run with env file
docker run -p 3001:3001 \
  --env-file .env.local \
  --name hialice \
  hialice:latest

# Check health
curl http://localhost:3001/health
```

---

## Troubleshooting

### Service Worker not registering?

1. Check HTTPS (required for production)
2. Verify `/sw.js` is accessible:
   ```
   curl http://localhost:3001/sw.js
   ```
3. Check browser console for errors
4. Try hard refresh: Ctrl+Shift+R

### Offline banner not showing?

1. Check component is imported in layout.js
2. Verify offline state: `navigator.onLine` in console
3. Try disabling network in DevTools
4. Check for hydration issues (check console)

### Docker build fails?

```bash
# Clean cache and try again
docker system prune --all
docker-compose up -d --build

# Check build logs
docker build -t hialice:latest . 2>&1 | tail -50
```

### Health check failing?

1. Verify backend is running
2. Check `/health` endpoint exists in backend
3. Check port 3001 is accessible
4. View logs: `docker logs hialice-app`

---

## Performance Tips

### Optimize Skeleton Loading

```javascript
// Use Suspense for better UX
import { Suspense } from 'react';
import { SkeletonCard } from '@/components/LoadingSkeleton';

export default function BooksPage() {
  return (
    <Suspense fallback={<SkeletonCard />}>
      <BooksList />
    </Suspense>
  );
}
```

### Cache Static Assets

Service worker already does this. To verify:
1. Open DevTools → Network
2. Load a page
3. Go offline
4. Reload page
5. Check Network tab for "from ServiceWorker"

### Reduce API Calls with Offline Data

```javascript
// Cache API responses locally
const getCachedData = async (key) => {
  if (!navigator.onLine) {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  }

  const data = await fetchFromAPI(key);
  localStorage.setItem(key, JSON.stringify(data));
  return data;
};
```

---

## File Locations Reference

```
/frontend/
  ├── src/
  │   ├── components/
  │   │   ├── ErrorBoundary.js ← Use for error handling
  │   │   ├── LoadingSkeleton.js ← Use for loading states
  │   │   └── OfflineBanner.js ← Auto-imported in layout
  │   ├── app/
  │   │   ├── layout.js ← Contains ErrorBoundary, OfflineBanner
  │   │   └── offline/
  │   │       └── page.js ← Offline fallback page
  │   └── ...
  ├── public/
  │   ├── manifest.json ← PWA config
  │   ├── sw.js ← Service worker
  │   └── ...
  ├── next.config.js ← PWA headers
  └── ...

/scripts/
  └── deploy.sh ← Deployment script

/.env.example ← Copy to .env.local
/Dockerfile ← Docker build
/docker-compose.yml ← Local dev setup
```

---

## Next Steps

1. **Test locally**: `docker-compose up -d`
2. **Try offline**: DevTools → Network → Offline checkbox
3. **Test errors**: Throw error in component → catch with ErrorBoundary
4. **Check SW**: DevTools → Application → Service Workers
5. **Configure env**: Copy .env.example to .env.local
6. **Deploy**: Use docker or `bash scripts/deploy.sh production`

---

## Support & Questions

For issues or questions:
1. Check console logs (F12)
2. Review PHASE5_DEPLOYMENT_GUIDE.md
3. Check service worker status in DevTools
4. Test with network disabled (DevTools)
5. Check .env.local configuration

---

*HiAlice Phase 5 Integration Guide — v1.0 | March 2026*
