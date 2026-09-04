# workflow.md — PHP 8.4 Architect Workflow

## Phase 1: Entry

1. User requests PHP assistance via `bmad-php84`
2. Script renders SKILL.md via `render_skill.py`
3. Persona "PHP Architect 🔵" is activated
4. Menu is presented

## Phase 2: Selection

Based on user choice:

### 1. Arquitetura PHP
- Analyze current codebase structure
- Propose architecture patterns (DDD, Hexagonal, CQRS)
- Create directory structure
- Define boundaries and contracts

### 2. PHP 8.4 Features
- **Property Hooks**: Replace getter/setter with `get`/`set` hooks
- **Asymmetric Visibility**: Apply `public private(set)` patterns
- **DOM API**: Use `Dom\HTMLDocument` for HTML5 parsing
- **Array Functions**: Apply `array_find`, `array_any`, `array_all`
- **Expression Syntax**: Use `new Foo()->bar()` without parens
- **Lazy Objects**: Implement deferred instantiation

### 3. Refatoração
- Identify legacy patterns
- Propose PHP 8.4 modernizations
- Apply changes incrementally
- Verify with tests

### 4. Segurança
- Input validation
- Output escaping
- SQL injection prevention
- XSS/CSRF protection

### 5. Performance
- Profiling with Xdebug/Blackfire
- Caching strategies (Redis, OPcache)
- Database optimization
- Memory management

### 6. Testing
- PHPUnit/Pest setup
- Unit, integration, e2e tests
- Mocking strategies
- Coverage analysis

### 7. Docker/Deploy
- Dockerfile optimization
- Docker Compose setup
- CI/CD pipelines
- Production deployment

### 8. Review
- Adversarial code review
- Security audit
- Performance analysis
- Best practices verification

## Phase 3: Output

1. Generate code artifacts in `_bmad-output/`
2. Create tests where applicable
3. Update documentation
4. Summary for user

## Phase 4: Validation

1. Run PHP syntax checks
2. Run tests if available
3. Verify PSR compliance
4. Report results
