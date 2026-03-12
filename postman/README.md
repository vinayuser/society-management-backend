# Postman Collection – Member / Resident APIs

Use this collection to test APIs available to **flat owners and society members** (resident role) in the Society Management application.

## Setup

1. **Import** `Society-Management-Member-APIs.postman_collection.json` into Postman.
2. **Set variables** (Collection → Variables):
   - `base_url`: Your API base URL (e.g. `http://localhost:3000`)
   - `access_token`: Leave empty; it is set automatically after **Login**.
3. **Login**: Run the **Auth → Login** request with a resident user’s email and password. The collection script will save the token to `access_token`. All other requests use this token via Bearer auth.

## Member APIs Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Auth** | | |
| POST | `/auth/login` | Login (email + password). Returns `accessToken`, `refreshToken`. |
| GET | `/auth/me` | Current user profile. |
| GET | `/app/profile` | Profile including linked flats. |
| GET | `/app/my-flats` | Flats assigned to the resident. |
| POST | `/auth/refresh` | Refresh access token. |
| POST | `/auth/logout` | Logout (revoke token). |
| **Society** | | |
| GET | `/societies/me/config` | Society config (logo, theme, address, etc.). |
| **Notices** | | |
| GET | `/notices` | List notices. |
| **Complaints** | | |
| GET | `/complaints` | List complaints (resident sees own). |
| POST | `/complaints` | Create complaint. |
| **Visitors** | | |
| GET | `/visitors` | List visitors (resident sees only their flat). |
| POST | `/visitors/entry` | Log visitor entry (only for resident’s flat). |
| **Deliveries** | | |
| GET | `/deliveries` | List deliveries (resident sees only their flat). |
| PATCH | `/deliveries/:id/status` | Update status (e.g. `collected`) for own flat’s deliveries. |
| **Marketplace** | | |
| GET | `/marketplace` | List community marketplace items. |
| GET | `/marketplace/:id` | Get one item. |
| POST | `/marketplace` | Create listing. |
| PATCH | `/marketplace/:id` | Update own listing. |
| POST | `/marketplace/:id/media` | Upload media (form-data). |
| POST | `/marketplace/transactions` | Create transaction. |
| **Lost & Found** | | |
| GET | `/lost-found` | List lost & found. |
| POST | `/lost-found` | Create lost/found item. |
| **Polls** | | |
| GET | `/polls` | List polls. |
| POST | `/polls/:id/vote` | Vote in poll. |
| **Chat** | | |
| GET | `/chat/groups` | List chat groups. |
| GET | `/chat/groups/society-users` | Society users. |
| GET | `/chat/messages?groupId=1` | Messages in group. |
| POST | `/chat/message` | Send message. |

## Notes

- All requests (except Login and Refresh) must send **Authorization: Bearer \<access_token\>**.
- Society context is taken from the JWT (user’s `society_id`). No need to pass society alias for these app APIs.
- Residents can only access data for their own flat(s) for visitors and deliveries.
