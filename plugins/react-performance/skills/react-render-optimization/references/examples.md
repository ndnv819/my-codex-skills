# React Performance Refactor Examples

Use these examples as patterns, not as code to paste blindly. Match the repository's component style, state library, router, data fetching layer, and lint rules.

## Isolate Ticking State

Before: the parent re-renders the full list every second.

```tsx
function Dashboard({ items }: { items: Item[] }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section>
      <span>{new Date(now).toLocaleTimeString()}</span>
      <ItemList items={items} />
    </section>
  );
}
```

After: the timer updates only the clock subtree.

```tsx
function Clock() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return <span>{new Date(now).toLocaleTimeString()}</span>;
}

function Dashboard({ items }: { items: Item[] }) {
  return (
    <section>
      <Clock />
      <ItemList items={items} />
    </section>
  );
}
```

## Stabilize Handlers For Memoized Rows

Before: `Row` cannot benefit from `memo` because `onSelect` changes identity on every render.

```tsx
const Row = memo(function Row({
  item,
  onSelect,
}: {
  item: Item;
  onSelect: (id: string) => void;
}) {
  return <button onClick={() => onSelect(item.id)}>{item.name}</button>;
});

function ItemList({ items }: { items: Item[] }) {
  return items.map((item) => (
    <Row key={item.id} item={item} onSelect={(id) => console.log(id)} />
  ));
}
```

After: the callback is stable, so unchanged rows can skip rendering.

```tsx
const Row = memo(function Row({
  item,
  onSelect,
}: {
  item: Item;
  onSelect: (id: string) => void;
}) {
  return <button onClick={() => onSelect(item.id)}>{item.name}</button>;
});

function ItemList({ items }: { items: Item[] }) {
  const handleSelect = useCallback((id: string) => {
    console.log(id);
  }, []);

  return items.map((item) => (
    <Row key={item.id} item={item} onSelect={handleSelect} />
  ));
}
```

## Prefer Narrow Props

Before: a child receives the whole object and re-renders whenever the object identity changes.

```tsx
const UserBadge = memo(function UserBadge({ user }: { user: User }) {
  return <span>{user.displayName}</span>;
});
```

After: pass only the field the child needs.

```tsx
const UserBadge = memo(function UserBadge({
  displayName,
}: {
  displayName: string;
}) {
  return <span>{displayName}</span>;
});
```

## Memoize Expensive Derived Data

Before: filtering and sorting run on every render.

```tsx
function SearchResults({ items, query }: Props) {
  const results = items
    .filter((item) => item.name.includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));

  return <ResultList items={results} />;
}
```

After: the work reruns only when inputs change.

```tsx
function SearchResults({ items, query }: Props) {
  const results = useMemo(() => {
    return items
      .filter((item) => item.name.includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query]);

  return <ResultList items={results} />;
}
```

## Split Context Values

Before: every consumer rerenders when any field in `value` changes.

```tsx
function AppProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState("");

  const value = {
    draft,
    setDraft,
    theme: "light",
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
```

After: fast-changing state is separated from stable configuration.

```tsx
const DraftContext = createContext<DraftState | null>(null);
const ThemeContext = createContext<ThemeState | null>(null);

function AppProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState("");
  const draftValue = useMemo(() => ({ draft, setDraft }), [draft]);
  const themeValue = useMemo(() => ({ theme: "light" }), []);

  return (
    <ThemeContext.Provider value={themeValue}>
      <DraftContext.Provider value={draftValue}>
        {children}
      </DraftContext.Provider>
    </ThemeContext.Provider>
  );
}
```

## Virtualize Large Lists

Use the platform default unless the project already has a different virtualization library installed and used consistently.

Platform defaults:
- React Web: `@tanstack/react-virtual`
- React Native, including Expo: `@shopify/flash-list`

Do not hand-roll virtualization for normal lists, tables, logs, chat histories, or search results.

### React Web: `@tanstack/react-virtual`

Install with the repository's package manager if it is not already present.

```bash
npm install @tanstack/react-virtual
```

Common alternatives:

```bash
pnpm add @tanstack/react-virtual
yarn add @tanstack/react-virtual
bun add @tanstack/react-virtual
```

```tsx
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

function LargeResultList({ rows }: { rows: RowData[] }) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    getItemKey: (index) => rows[index].id,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      style={{ height: 600, overflow: "auto", width: "100%" }}
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: "relative",
          width: "100%",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              left: 0,
              position: "absolute",
              top: 0,
              transform: `translateY(${virtualRow.start}px)`,
              width: "100%",
            }}
          >
            <ResultRow row={rows[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### React Native / Expo: `@shopify/flash-list`

Install with the project's environment when it is not already present.

Expo:

```bash
npx expo install @shopify/flash-list
```

React Native CLI:

```bash
npm install @shopify/flash-list
cd ios && pod install
```

Replace long `FlatList`, `SectionList`, or `ScrollView` + `items.map(...)` rendering with `FlashList` in React Native and Expo apps.

```tsx
import { FlashList } from "@shopify/flash-list";

function ResultList({ items }: { items: ResultItem[] }) {
  return (
    <FlashList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ResultRow item={item} />}
    />
  );
}
```
