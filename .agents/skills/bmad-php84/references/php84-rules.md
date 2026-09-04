# PHP 8.4 Rules & Constraints

## Core Rules

### PHP001 — Strict Types Declaration
- All PHP files MUST start with `<?php declare(strict_types=1);`
- No short tags `<?` — always use `<?php`

### PHP002 — Property Hooks (PHP 8.4)
- Use `get` and `set` hooks to replace boilerplate getter/setter methods
- Hooks MUST be declared in the property block
- Hook body uses `->value` to access the underlying value
```php
class User {
    public string $name {
        get => $this->name;
        set(string $value) {
            if (strlen($value) < 2) {
                throw new InvalidArgumentException('Name too short');
            }
            $this->name = strtolower($value);
        }
    }
}
```

### PHP003 — Asymmetric Visibility (PHP 8.4)
- Use `public private(set)` or `public protected(set)` to control mutation
- Read access is public, write access is restricted
- Applicable to properties and property hooks
```php
class Order {
    public private(set) float $total = 0.0;
    
    public function addItem(float $price): void {
        $this->total += $price; // OK — inside class
    }
}

$order = new Order();
$order->total = 100.0; // ERROR — private(set)
```

### PHP004 — New Expression Syntax (PHP 8.4)
- `new MyClass()->method()` — no parentheses needed
- Chains directly on constructor call
```php
// Before (PHP 8.3)
$result = (new MyClass())->doSomething();

// After (PHP 8.4)
$result = new MyClass()->doSomething();
```

### PHP005 — DOM API with HTML5 (PHP 8.4)
- Use `Dom\HTMLDocument` instead of `DOMDocument`
- Native HTML5 parsing support
- Better namespace handling
```php
$dom = new Dom\HTMLDocument();
$dom->loadHTML($html);
$elements = $dom->querySelectorAll('.class');
```

### PHP006 — Array Functions (PHP 8.4)
- `array_find(array $array, callable $callback): mixed` — first match
- `array_find_key(array $array, callable $callback): int|string|null` — key of first match
- `array_any(array $array, callable $callback): bool` — true if any match
- `array_all(array $array, callable $callback): bool` — true if all match
```php
$users = [
    ['name' => 'Alice', 'age' => 30],
    ['name' => 'Bob', 'age' => 25],
];

$first = array_find($users, fn($u) => $u['age'] > 28); // Alice
$hasMinor = array_any($users, fn($u) => $u['age'] < 18); // false
$allAdults = array_all($users, fn($u) => $u['age'] >= 18); // true
```

### PHP007 — #[\Deprecated] Attribute (PHP 8.4)
- Mark methods/functions as deprecated with attribute
- PHP emits E_USER_DEPRECATED when called
```php
#[\Deprecated('Use newMethod() instead')]
public function oldMethod(): void {
    // ...
}
```

### PHP008 — BCMath Object API (PHP 8.4)
- `BCMath\Number` for arbitrary precision arithmetic
- Immutable value object
- Operator overloading support
```php
$a = new BCMath\Number('1.5');
$b = new BCMath\Number('2.5');
$sum = $a + $b; // BCMath\Number('4')
```

### PHP009 — Lazy Objects (PHP 8.4)
- `new \ReflectionClass($class)->newLazyGhost()` for deferred init
- Useful for expensive database/entity loading
```php
$proxy = new \ReflectionClass(User::class)->newLazyGhost(
    fn() => $db->loadUser($id)
);
// User loaded only when properties accessed
```

### PHP010 — mb_trim Functions (PHP 8.4)
- `mb_trim(string $string): string` — multibyte trim
- `mb_ltrim(string $string): string` — multibyte left trim
- `mb_rtrim(string $string): string` — multibyte right trim
- Safe for UTF-8 and multibyte characters

### PHP011 — Typing Standards
- Use union types `string|int` over mixed
- Use intersection types `Countable&Iterator` where appropriate
- Use `never` return type for functions that never return
- Use readonly properties for immutable data
- Prefer enums over constants

### PHP012 — PSR Standards
- Follow PSR-12 (Extended Coding Style)
- Follow PSR-4 (Autoloading)
- Follow PSR-3 (Logger Interface)
- Use Composer for dependency management

### PHP013 — Error Handling
- Use exceptions over error codes
- Create custom exception hierarchy
- Never suppress errors with `@`
- Use `set_error_handler()` for legacy code integration

### PHP014 — Security
- Always validate and sanitize input
- Use prepared statements for SQL
- Escape output with `htmlspecialchars()`
- Use `random_bytes()` for cryptography
- Implement CSRF tokens

### PHP015 — Performance
- Enable OPcache in production
- Use `readonly` properties for memory efficiency
- Prefer `match` over `switch`
- Use named arguments for clarity
- Profile with Xdebug/Blackfire
