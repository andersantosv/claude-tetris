#!/usr/bin/env python3
"""Fetch current weather for a city using the free Open-Meteo API (no API key)."""
import json
import sys
import urllib.parse
import urllib.request

WEATHER_CODES = {
    0: "Despejado",
    1: "Mayormente despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Niebla",
    48: "Niebla con escarcha",
    51: "Llovizna ligera",
    53: "Llovizna moderada",
    55: "Llovizna intensa",
    61: "Lluvia ligera",
    63: "Lluvia moderada",
    65: "Lluvia intensa",
    66: "Lluvia helada ligera",
    67: "Lluvia helada intensa",
    71: "Nevada ligera",
    73: "Nevada moderada",
    75: "Nevada intensa",
    77: "Granizo fino",
    80: "Chubascos ligeros",
    81: "Chubascos moderados",
    82: "Chubascos violentos",
    85: "Chubascos de nieve ligeros",
    86: "Chubascos de nieve intensos",
    95: "Tormenta eléctrica",
    96: "Tormenta con granizo ligero",
    99: "Tormenta con granizo intenso",
}


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=10) as resp:
        return json.load(resp)


def geocode(city):
    url = (
        "https://geocoding-api.open-meteo.com/v1/search?"
        + urllib.parse.urlencode({"name": city, "count": 1, "language": "es", "format": "json"})
    )
    data = fetch_json(url)
    results = data.get("results")
    if not results:
        return None
    r = results[0]
    return {
        "name": r["name"],
        "country": r.get("country", ""),
        "admin1": r.get("admin1", ""),
        "latitude": r["latitude"],
        "longitude": r["longitude"],
    }


def get_weather(lat, lon):
    url = (
        "https://api.open-meteo.com/v1/forecast?"
        + urllib.parse.urlencode(
            {
                "latitude": lat,
                "longitude": lon,
                "current": (
                    "temperature_2m,relative_humidity_2m,apparent_temperature,"
                    "precipitation,weather_code,wind_speed_10m,wind_direction_10m"
                ),
                "timezone": "auto",
            }
        )
    )
    return fetch_json(url)


DEFAULT_CITY = "Lima, Peru"


def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        city = DEFAULT_CITY
    else:
        city = " ".join(sys.argv[1:])

    try:
        place = geocode(city)
    except Exception as e:
        print(f"Error consultando el servicio de geocodificación: {e}", file=sys.stderr)
        sys.exit(1)

    if place is None:
        print(f"No se encontró la ciudad: {city}", file=sys.stderr)
        sys.exit(1)

    try:
        weather = get_weather(place["latitude"], place["longitude"])
    except Exception as e:
        print(f"Error consultando el clima: {e}", file=sys.stderr)
        sys.exit(1)

    current = weather.get("current", {})
    code = current.get("weather_code")
    condition = WEATHER_CODES.get(code, "Desconocido")

    location_bits = [place["name"]]
    if place["admin1"]:
        location_bits.append(place["admin1"])
    if place["country"]:
        location_bits.append(place["country"])
    location = ", ".join(location_bits)

    print(f"Clima en {location}")
    print(f"  Condición:        {condition}")
    print(f"  Temperatura:      {current.get('temperature_2m')}°C")
    print(f"  Sensación térmica: {current.get('apparent_temperature')}°C")
    print(f"  Humedad relativa: {current.get('relative_humidity_2m')}%")
    print(f"  Precipitación:    {current.get('precipitation')} mm")
    print(f"  Viento:           {current.get('wind_speed_10m')} km/h ({current.get('wind_direction_10m')}°)")
    print(f"  Hora local:       {current.get('time')}")


if __name__ == "__main__":
    main()
