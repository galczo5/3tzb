# 3tzb - listowanie audycji radiowej "trójki"

## Opis
Aplikacja pozwala na automatyczne przejście przez stronę internetową radia i pobranie danych audycji.
Operacja wykonywana jest w trzech krokach:
- Pobraniu listy audycji
- Pobraniu listy odcinków dla każdej audycji
- Pobraniu listy plików dla każdego odcinka

Dane zapisywane są do pliku `json`.

## Wymagania
Zainstalowany NodeJS oraz Google Chrome.

## Instalacja
Instalacja z uzyciem repozytorium NPM:
```
npm i 3tzb -g
```

Budowa ze źródeł:
```
npm i
npm i -g
```

## Manual
```
Usage: 3tzb [options] [command]

Options:
  --output <absolute_path>  [required] output file path
  --input <absolute_path>   input file path
  --headless                use chrome in headless mode
  --force                   force override of existing data
  --title <title>           filter auditions by title
  --top <number>            get top <number> episodes for each audition
  -h, --help                output usage information

Commands:
  get-auditions             get list of auditions, can be filtered with `--title` option. To add audition to existing file use `--input` option
  get-episodes              get episodes for auditions in file
  get-files                 get files for auditions in file
```

Przykładowe pobranie listy audycji:
`3tzb.js get-auditions --output /home/kamil/Dev/3tzb/3tzb.json`

Przykładowe dodanie audycji do istniejącego pliku:
`3tzb.js get-auditions --input /home/kamil/Dev/3tzb/3tzb.json --output /home/kamil/Dev/3tzb/3tzb.json --title "mysliw"`

Przykładowe pobranie listy audycji:
`3tzb.js get-episodes --input /home/kamil/Dev/3tzb/3tzb.json --output /home/kamil/Dev/3tzb/3tzb.json`

Przykładowe pobranie listy plików:
`3tzb.js get-files --input /home/kamil/Dev/3tzb/3tzb.json --output /home/kamil/Dev/3tzb/3tzb.json`

## Znane błędy
Przejście między stronami na liście odcinków nie działa.
Błąd występuje dla audycji:
- 3 wymiary gitary
- Apteka nocna
- Bardzo ważny problem europejski
- Euranet Plus
- Nauka słuchania
- Soul - muzyka duszy
- Przyciasny beret

## Zgłaszanie błędów
Proszę o zgłaszanie błędów po przez mechanizm "Issues", z uwzględnieniem informacji o nazwie audycji oraz parametrach programu.

