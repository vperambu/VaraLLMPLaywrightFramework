# ═══════════════════════════════════════════════════════════════════
# Feature: Users CRUD API
#
# Generated via: SmartGen Pipeline (RAG)
# Jira Story: API-202 — User Management REST API
# Tags: @api @regression
# Uses: playwright.request (no browser required)
# ═══════════════════════════════════════════════════════════════════

@api
Feature: User Management REST API – CRUD Operations

  As an API consumer
  I want to perform CRUD operations on the /users endpoint
  So that I can manage user resources programmatically

  Background:
    Given the API base URL is configured

  # ──────────────────────────────────────────────────────────────
  # CREATE
  # ──────────────────────────────────────────────────────────────

  @smoke @post
  Scenario: Successfully create a new user
    When I send a POST request to "/users" with body:
      """
      {
        "name": "Jane Doe",
        "job": "QA Automation Architect"
      }
      """
    Then the response status code should be 201
    And the response body should contain field "id"
    And the response body should contain field "createdAt"
    And the response body "name" should equal "Jane Doe"

  @negative @post
  Scenario: Create user request fails with missing required fields
    When I send a POST request to "/users" with body:
      """
      {}
      """
    Then the response status code should be 400

  # ──────────────────────────────────────────────────────────────
  # READ
  # ──────────────────────────────────────────────────────────────

  @smoke @get
  Scenario: Successfully retrieve an existing user
    When I send a GET request to "/users/2"
    Then the response status code should be 200
    And the response body should contain field "data"
    And the response body "data.id" should equal "2"

  @get
  Scenario: Get request returns 404 for non-existent user
    When I send a GET request to "/users/9999"
    Then the response status code should be 404

  @get @pagination
  Scenario: List users endpoint supports pagination
    When I send a GET request to "/users?page=2"
    Then the response status code should be 200
    And the response body "page" should equal "2"
    And the response body should contain field "data"

  # ──────────────────────────────────────────────────────────────
  # UPDATE
  # ──────────────────────────────────────────────────────────────

  @put
  Scenario: Successfully update a user with PUT
    When I send a PUT request to "/users/2" with body:
      """
      {
        "name": "Jane Smith",
        "job": "Senior QA Engineer"
      }
      """
    Then the response status code should be 200
    And the response body "name" should equal "Jane Smith"
    And the response body should contain field "updatedAt"

  @patch
  Scenario: Successfully partially update a user with PATCH
    When I send a PATCH request to "/users/2" with body:
      """
      {
        "job": "Principal Architect"
      }
      """
    Then the response status code should be 200
    And the response body should contain field "updatedAt"

  # ──────────────────────────────────────────────────────────────
  # DELETE
  # ──────────────────────────────────────────────────────────────

  @delete
  Scenario: Successfully delete a user
    When I send a DELETE request to "/users/2"
    Then the response status code should be 204
