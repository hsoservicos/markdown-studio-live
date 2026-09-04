# PHP 8.4 Code Templates

## Template 1: DTO with Property Hooks & Asymmetric Visibility

```php
<?php declare(strict_types=1);

namespace App\DTO;

final class UserProfile
{
    public function __construct(
        public readonly string $id,
        public private(set) string $email,
        public private(set) string $displayName,
        public private(set) \DateTimeImmutable $createdAt,
    ) {
        $this->createdAt = new \DateTimeImmutable();
    }

    public string $email {
        set(string $value) {
            if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                throw new \InvalidArgumentException('Invalid email');
            }
            $this->email = strtolower($value);
        }
    }

    public string $displayName {
        set(string $value) {
            $trimmed = mb_trim($value);
            if (mb_strlen($trimmed) < 2) {
                throw new \InvalidArgumentException('Display name too short');
            }
            $this->displayName = $trimmed;
        }
    }

    public function updateEmail(string $newEmail): void
    {
        $this->email = $newEmail; // Uses hook validation
    }
}
```

## Template 2: DOM HTML5 Parser

```php
<?php declare(strict_types=1);

namespace App\Service;

final class HtmlParser
{
    public function parse(string $html): Dom\HTMLDocument
    {
        $dom = new Dom\HTMLDocument();
        $dom->loadHTML($html);
        return $dom;
    }

    public function extractLinks(string $html): array
    {
        $dom = $this->parse($html);
        $links = [];

        foreach ($dom->querySelectorAll('a[href]') as $link) {
            $links[] = [
                'url' => $link->getAttribute('href'),
                'text' => $link->textContent,
            ];
        }

        return $links;
    }

    public function extractMetadata(string $html): array
    {
        $dom = $this->parse($html);
        $meta = [];

        foreach ($dom->querySelectorAll('meta[name], meta[property]') as $tag) {
            $key = $tag->getAttribute('name') ?: $tag->getAttribute('property');
            $meta[$key] = $tag->getAttribute('content');
        }

        return $meta;
    }
}
```

## Template 3: Array Functions Usage

```php
<?php declare(strict_types=1);

namespace App\Collection;

final class UserCollection
{
    public function __construct(
        private readonly array $users
    ) {}

    public function findActive(): ?array
    {
        return array_find($this->users, fn($u) => $u['active'] === true);
    }

    public function findActiveKey(): int|string|null
    {
        return array_find_key($this->users, fn($u) => $u['active'] === true);
    }

    public function hasAdmin(): bool
    {
        return array_any($this->users, fn($u) => $u['role'] === 'admin');
    }

    public function allVerified(): bool
    {
        return array_all($this->users, fn($u) => $u['verified'] === true);
    }

    public function filterByRole(string $role): array
    {
        return array_filter(
            $this->users,
            fn($u) => $u['role'] === $role,
            ARRAY_FILTER_USE_BOTH
        );
    }
}
```

## Template 4: BCMath Object API

```php
<?php declare(strict_types=1);

namespace App\Math;

final class Money
{
    private BCMath\Number $amount;

    public function __construct(string $amount)
    {
        $this->amount = new BCMath\Number($amount);
    }

    public function add(Money $other): self
    {
        return new self((string) ($this->amount + $other->amount));
    }

    public function subtract(Money $other): self
    {
        return new self((string) ($this->amount - $other->amount));
    }

    public function multiply(int $factor): self
    {
        return new self((string) ($this->amount * $factor));
    }

    public function isGreaterThan(Money $other): bool
    {
        return $this->amount > $other->amount;
    }

    public function __toString(): string
    {
        return (string) $this->amount;
    }
}
```

## Template 5: Lazy Object for Database Entity

```php
<?php declare(strict_types=1);

namespace App\Entity;

final class User
{
    public readonly string $id;
    public string $name;
    public string $email;

    public static function lazyLoad(string $id, Database $db): self
    {
        $reflection = new \ReflectionClass(self::class);
        $proxy = $reflection->newLazyGhost(function (self $user) use ($id, $db) {
            $data = $db->query('SELECT * FROM users WHERE id = ?', [$id])->fetch();
            if (!$data) {
                throw new \RuntimeException("User {$id} not found");
            }
            $user->id = $data['id'];
            $user->name = $data['name'];
            $user->email = $data['email'];
        });

        return $proxy;
    }
}

// Usage: DB query only happens when properties are accessed
$user = User::lazyLoad('123', $db);
// No query yet...
echo $user->name; // Query executes now
```

## Template 6: #[\Deprecated] Pattern

```php
<?php declare(strict_types=1);

namespace App\Service;

final class PaymentProcessor
{
    public function process(Payment $payment): Result
    {
        return $this->processV2($payment);
    }

    #[\Deprecated('Use process() instead — this method will be removed in v3.0')]
    public function processLegacy(array $data): Result
    {
        $payment = Payment::fromArray($data);
        return $this->process($payment);
    }

    private function processV2(Payment $payment): Result
    {
        // New implementation
    }
}
```

## Template 7: Match Expression with Enums

```php
<?php declare(strict_types=1);

enum Status: string
{
    case Pending = 'pending';
    case Active = 'active';
    case Suspended = 'suspended';
    case Deleted = 'deleted';
}

function getStatusColor(Status $status): string
{
    return match ($status) {
        Status::Pending => 'gray',
        Status::Active => 'green',
        Status::Suspended => 'orange',
        Status::Deleted => 'red',
    };
}
```

## Template 8: New Expression Syntax

```php
<?php declare(strict_types=1);

// Before (PHP 8.3)
$result = (new HttpClient())->get('https://api.example.com/users');

// After (PHP 8.4)
$result = new HttpClient()->get('https://api.example.com/users');

// Chained calls
$user = new UserRepository($db)
    ->findByEmail('user@example.com')
    ->orElse(fn() => new GuestUser());
```
